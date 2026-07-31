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
  ): Promise<{ id: string }> {
    const session = this.sessions.create({
      roomSlug: claims.room,
      identity: claims.identity,
      displayName: claims.name,
      userId,
    });
    await this.sessions.save(session);
    return { id: session.id };
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
