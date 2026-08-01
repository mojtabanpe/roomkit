import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingSession } from '../database/entities/meeting-session.entity';
import { Message } from '../database/entities/message.entity';
import { RoomClaims } from './room-token.guard';

export interface ChatMessageDto {
  id: string;
  senderIdentity: string;
  senderName: string;
  body: string;
  at: string;
}

/** How much history a joiner receives. */
const HISTORY_LIMIT = 200;

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

/**
 * An empty room for this long ends the meeting: the next join starts a fresh
 * timer instead of continuing last week's. Short gaps are deliberately
 * tolerated — a page reload closes and reopens a session in a second or two,
 * and that must not look like a new meeting.
 */
const MEETING_GAP_MS = 2 * 60_000;

/**
 * A session only gets a `leftAt` when someone leaves gracefully; a closed
 * laptop leaves the row open forever. Past this age we stop believing an open
 * session is still in the room, otherwise one abandoned row would chain every
 * later meeting onto it.
 */
const STALE_OPEN_MS = 12 * 60 * 60_000;

/** How far back the meeting-start scan looks. */
const SESSION_SCAN_LIMIT = 500;

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(MeetingSession)
    private readonly sessions: Repository<MeetingSession>,
  ) {}

  async history(roomSlug: string): Promise<ChatMessageDto[]> {
    const rows = await this.messages.find({
      where: { roomSlug },
      order: { createdAt: 'DESC' },
      take: HISTORY_LIMIT,
    });
    return rows.reverse().map((m) => this.toDto(m));
  }

  async addMessage(
    claims: RoomClaims,
    id: string,
    body: string,
    userId: string | null,
  ): Promise<ChatMessageDto> {
    const message = this.messages.create({
      id,
      roomSlug: claims.room,
      senderIdentity: claims.identity,
      senderName: claims.name,
      senderUserId: userId,
      body,
      createdAt: new Date(),
    });

    try {
      // insert(), not save(): save() would UPDATE an existing row, letting a
      // caller overwrite someone else's message by reusing its id.
      await this.messages.insert(message);
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('این پیام قبلاً ثبت شده است.');
      }
      throw err;
    }
    return this.toDto(message);
  }

  async startSession(
    claims: RoomClaims,
    userId: string | null,
  ): Promise<{ id: string; startedAt: string }> {
    const session = this.sessions.create({
      roomSlug: claims.room,
      identity: claims.identity,
      displayName: claims.name,
      userId,
    });
    await this.sessions.save(session);

    // Answered here rather than from a separate endpoint so a joiner learns
    // the meeting's origin in the same round-trip that registers them.
    const startedAt = await this.meetingStartedAt(claims.room);
    return { id: session.id, startedAt: startedAt.toISOString() };
  }

  /**
   * When the meeting currently running in this room began — the join time of
   * the first person in, so every participant's timer reads the same.
   *
   * Sessions overlap and interleave, so this merges them into runs of
   * continuous occupancy (tolerating `MEETING_GAP_MS` of emptiness) and
   * returns the start of the most recent run. Rows the caller just inserted
   * are included, so this is never empty in practice.
   */
  private async meetingStartedAt(roomSlug: string): Promise<Date> {
    const now = Date.now();
    const rows = await this.sessions.find({
      where: { roomSlug },
      order: { joinedAt: 'DESC' },
      take: SESSION_SCAN_LIMIT,
    });
    if (!rows.length) return new Date(now);

    const spans = rows
      .map((r) => {
        const from = r.joinedAt.getTime();
        const to = r.leftAt
          ? r.leftAt.getTime()
          : Math.min(now, from + STALE_OPEN_MS);
        return { from, to: Math.max(from, to) };
      })
      .sort((a, b) => a.from - b.from);

    let start = spans[0].from;
    let cover = spans[0].to;
    for (const span of spans.slice(1)) {
      if (span.from - cover > MEETING_GAP_MS) {
        // The room stood empty long enough: a new meeting begins here.
        start = span.from;
        cover = span.to;
      } else {
        cover = Math.max(cover, span.to);
      }
    }
    return new Date(start);
  }

  async endSession(claims: RoomClaims, id: string): Promise<void> {
    // Scope by identity so one participant cannot close another's session.
    const session = await this.sessions.findOne({
      where: { id, identity: claims.identity, roomSlug: claims.room },
    });
    if (!session) throw new NotFoundException('نشست پیدا نشد.');
    if (session.leftAt) return;

    session.leftAt = new Date();
    await this.sessions.save(session);
  }

  /** Rooms this user has recently been in, newest first. */
  async recentForUser(userId: string) {
    const rows = await this.sessions.find({
      where: { userId },
      order: { joinedAt: 'DESC' },
      take: 50,
    });

    const seen = new Set<string>();
    return rows
      .filter((r) => !seen.has(r.roomSlug) && seen.add(r.roomSlug))
      .slice(0, 10)
      .map((r) => ({
        roomSlug: r.roomSlug,
        joinedAt: r.joinedAt.toISOString(),
        leftAt: r.leftAt?.toISOString() ?? null,
      }));
  }

  private toDto(m: Message): ChatMessageDto {
    return {
      id: m.id,
      senderIdentity: m.senderIdentity,
      senderName: m.senderName,
      body: m.body,
      at: m.createdAt.toISOString(),
    };
  }
}
