import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ParticipantInfo, TrackSource } from 'livekit-server-sdk';
import { Repository } from 'typeorm';
import { Room, RoomVisibility } from '../database/entities/room.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { JoinTokenResponse, LivekitService } from '../livekit/livekit.service';
import { ROOM_SLUG_MESSAGE, ROOM_SLUG_PATTERN } from '../rooms/slug';
import { ApiKeyGuard, CurrentTenant } from '../tenants/api-key.guard';
import { livekitRoomName } from '../tenants/room-name';
import { TenantRoomPolicyService } from '../tenants/tenant-room-policy.service';
import { BalanceView, UsageService } from '../usage/usage.service';

/** Same cost as user passwords — a 4-6 digit PIN is worth slowing down. */
const PASSCODE_ROUNDS = 12;

class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(ROOM_SLUG_PATTERN, { message: ROOM_SLUG_MESSAGE })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: RoomVisibility;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  passcode?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  maxParticipants?: number;
}

class MintTokenDto {
  /** The platform's own user id. Must be unique within the room. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  identity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;
}

/**
 * Track sources as the platform names them. Kept to LiveKit's own four so a
 * value here always means exactly one `TrackSource`.
 */
const SOURCE_NAMES = [
  'camera',
  'microphone',
  'screen_share',
  'screen_share_audio',
] as const;
type SourceName = (typeof SOURCE_NAMES)[number];

const SOURCE_TO_TRACK: Record<SourceName, TrackSource> = {
  camera: TrackSource.CAMERA,
  microphone: TrackSource.MICROPHONE,
  screen_share: TrackSource.SCREEN_SHARE,
  screen_share_audio: TrackSource.SCREEN_SHARE_AUDIO,
};

const TRACK_TO_SOURCE = new Map<TrackSource, SourceName>(
  SOURCE_NAMES.map((name) => [SOURCE_TO_TRACK[name], name]),
);

class MuteDto {
  /** What to mute. Omitted means the microphone — the usual "quiet, please". */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SOURCE_NAMES, { each: true })
  sources?: SourceName[];
}

class PermissionsDto {
  @IsBoolean()
  canPublish!: boolean;

  /**
   * Narrows `canPublish: true` to these sources — e.g. `["microphone"]` lets a
   * student speak without turning a camera on. Omitted means every source.
   * Ignored when `canPublish` is false.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SOURCE_NAMES, { each: true })
  sources?: SourceName[];
}

interface ParticipantView {
  identity: string;
  name: string;
  joinedAt: string | null;
  canPublish: boolean;
  /** empty while `canPublish` is true means every source is allowed */
  canPublishSources: SourceName[];
  tracks: { sid: string; source: SourceName | 'unknown'; muted: boolean }[];
}

interface RoomView {
  slug: string;
  name: string;
  visibility: RoomVisibility;
  hasPasscode: boolean;
  maxParticipants: number | null;
  livekitRoom: string;
  createdAt: Date;
}

interface TenantAccountView {
  name: string;
  key: string;
  planMode: Tenant['planMode'];
  maxParticipants: number | null;
  active: boolean;
  createdAt: Date;
}

/**
 * The API a partner platform calls from its **backend**, with `X-Api-Key`.
 * Their own UI talks straight to LiveKit with the token this hands back; we
 * only issue credentials and count the minutes.
 */
@Controller('v1')
@UseGuards(ApiKeyGuard)
export class PlatformController {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    private readonly livekit: LivekitService,
    private readonly usage: UsageService,
    private readonly policies: TenantRoomPolicyService,
  ) {}

  @Get('usage')
  usageSummary(@CurrentTenant() tenant: Tenant): Promise<BalanceView> {
    return this.usage.balanceOf(tenant);
  }

  @Get('account')
  account(@CurrentTenant() tenant: Tenant): TenantAccountView {
    return {
      name: tenant.name,
      key: tenant.key,
      planMode: tenant.planMode,
      maxParticipants: this.policies.limits(tenant).maxParticipants,
      active: tenant.active,
      createdAt: tenant.createdAt,
    };
  }

  @Get('rooms')
  async listRooms(@CurrentTenant() tenant: Tenant): Promise<RoomView[]> {
    const rooms = await this.rooms.find({
      where: { tenantId: tenant.id },
      order: { createdAt: 'DESC' },
    });
    return rooms.map((room) => this.view(tenant, room));
  }

  @Post('rooms')
  async createRoom(
    @CurrentTenant() tenant: Tenant,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomView> {
    const visibility = dto.visibility ?? 'public';
    if (visibility === 'private' && !dto.passcode) {
      throw new ForbiddenException('اتاق خصوصی بدون رمز ساخته نمی‌شود.');
    }
    if (await this.rooms.existsBy({ tenantId: tenant.id, slug: dto.slug })) {
      throw new ConflictException('این اتاق قبلاً ثبت شده است.');
    }

    const room = await this.rooms.save(
      this.rooms.create({
        tenantId: tenant.id,
        ownerId: null,
        slug: dto.slug,
        name: dto.name,
        visibility,
        passcodeHash: dto.passcode
          ? await bcrypt.hash(dto.passcode, PASSCODE_ROUNDS)
          : null,
        maxParticipants: this.policies.limits(tenant, dto.maxParticipants)
          .maxParticipants,
      }),
    );
    return this.view(tenant, room);
  }

  @Get('rooms/:slug')
  async getRoom(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
  ): Promise<RoomView> {
    return this.view(tenant, await this.mustFind(tenant, slug));
  }

  @Delete('rooms/:slug')
  async deleteRoom(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
  ): Promise<{ ok: true }> {
    const room = await this.mustFind(tenant, slug);
    await this.rooms.remove(room);
    return { ok: true };
  }

  /**
   * Mint a join token. No passcode is asked for here — the passcode guards the
   * *public* join path, and a platform holding the API key already owns the
   * room, so making it repeat its own PIN would prove nothing.
   */
  @Post('rooms/:slug/tokens')
  async mintToken(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
    @Body() dto: MintTokenDto,
  ): Promise<JoinTokenResponse> {
    const room = await this.mustFind(tenant, slug);

    const livekitRoom = livekitRoomName(tenant.key, room.slug);
    const admission = await this.policies.admission(tenant, livekitRoom);
    if ('reason' in admission) {
      throw new HttpException(
        admission.reason === 'duration_exceeded'
          ? 'زمان ۳۰ دقیقه‌ای این جلسه به پایان رسیده است.'
          : 'اعتبار این حساب تمام شده است.',
        admission.reason === 'duration_exceeded'
          ? HttpStatus.GONE
          : HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const limits = this.policies.limits(tenant, room.maxParticipants);
    if (
      limits.maxParticipants !== null &&
      (await this.livekit.activeParticipantCount(livekitRoom)) >=
        limits.maxParticipants
    ) {
      throw new HttpException('ظرفیت این اتاق تکمیل است.', HttpStatus.CONFLICT);
    }
    // Create it first so the participant cap is the server's, not the client's.
    await this.livekit.ensureRoom(livekitRoom, limits.maxParticipants);

    return this.livekit.createJoinToken({
      room: livekitRoom,
      identity: dto.identity,
      name: dto.name,
      canPublish: dto.canPublish,
      limits,
    });
  }

  /** Who is connected right now, and what each of them is sending. */
  @Get('rooms/:slug/participants')
  async participants(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
  ): Promise<ParticipantView[]> {
    const room = await this.mustFind(tenant, slug);
    const people = await this.livekit.listParticipants(
      livekitRoomName(tenant.key, room.slug),
    );
    return people.map((person) => this.participantView(person));
  }

  /**
   * Mutes one participant's tracks. They can unmute themselves — to take the
   * right to speak away, use `permissions` with `canPublish: false`.
   */
  @Post('rooms/:slug/participants/:identity/mute')
  @HttpCode(HttpStatus.OK)
  async mute(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
    @Param('identity') identity: string,
    @Body() dto: MuteDto,
  ): Promise<{ ok: true; muted: number }> {
    const room = await this.mustFind(tenant, slug);
    const sources = (dto.sources ?? ['microphone']).map(
      (name) => SOURCE_TO_TRACK[name],
    );
    const muted = await this.livekit.muteSources(
      livekitRoomName(tenant.key, room.slug),
      identity,
      sources,
    );
    if (muted === null) throw this.notInRoom();
    return { ok: true, muted };
  }

  /**
   * Changes what a connected participant may publish, live. The participant's
   * browser gets `ParticipantPermissionsChanged` and can open its microphone at
   * once — no new token, no reconnect. It lasts for this connection only: the
   * next token you mint decides again, so store the grant on your side too.
   */
  @Post('rooms/:slug/participants/:identity/permissions')
  @HttpCode(HttpStatus.OK)
  async setPermissions(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
    @Param('identity') identity: string,
    @Body() dto: PermissionsDto,
  ): Promise<ParticipantView> {
    const room = await this.mustFind(tenant, slug);
    const sources = dto.canPublish
      ? (dto.sources ?? SOURCE_NAMES).map((name) => SOURCE_TO_TRACK[name])
      : [];
    if (dto.canPublish && sources.length === 0) {
      throw new BadRequestException(
        'برای اجازهٔ انتشار دست‌کم یک منبع لازم است.',
      );
    }
    const updated = await this.livekit.setPublishSources(
      livekitRoomName(tenant.key, room.slug),
      identity,
      sources,
    );
    if (!updated) throw this.notInRoom();
    return this.participantView(updated);
  }

  /** Disconnects one participant. A fresh token lets them back in — refusing one is yours to do. */
  @Delete('rooms/:slug/participants/:identity')
  async removeParticipant(
    @CurrentTenant() tenant: Tenant,
    @Param('slug') slug: string,
    @Param('identity') identity: string,
  ): Promise<{ ok: true }> {
    const room = await this.mustFind(tenant, slug);
    const livekitRoom = livekitRoomName(tenant.key, room.slug);
    if (!(await this.livekit.getParticipant(livekitRoom, identity))) {
      throw this.notInRoom();
    }
    await this.livekit.removeParticipant(livekitRoom, identity);
    return { ok: true };
  }

  private notInRoom(): NotFoundException {
    return new NotFoundException('این شرکت‌کننده الان در اتاق نیست.');
  }

  private participantView(person: ParticipantInfo): ParticipantView {
    const permission = person.permission;
    const joinedAt = Number(person.joinedAt);
    return {
      identity: person.identity,
      name: person.name,
      joinedAt: joinedAt > 0 ? new Date(joinedAt * 1000).toISOString() : null,
      canPublish: permission?.canPublish ?? false,
      canPublishSources: (permission?.canPublishSources ?? [])
        .map((source) => TRACK_TO_SOURCE.get(source))
        .filter((name): name is SourceName => name !== undefined),
      tracks: person.tracks.map((track) => ({
        sid: track.sid,
        source: TRACK_TO_SOURCE.get(track.source) ?? 'unknown',
        muted: track.muted,
      })),
    };
  }

  private async mustFind(tenant: Tenant, slug: string): Promise<Room> {
    const room = await this.rooms.findOne({
      where: { tenantId: tenant.id, slug },
    });
    if (!room) throw new NotFoundException('اتاق پیدا نشد.');
    return room;
  }

  private view(tenant: Tenant, room: Room): RoomView {
    return {
      slug: room.slug,
      name: room.name,
      visibility: room.visibility,
      hasPasscode: room.passcodeHash !== null,
      maxParticipants: this.policies.limits(tenant, room.maxParticipants)
        .maxParticipants,
      livekitRoom: livekitRoomName(tenant.key, room.slug),
      createdAt: room.createdAt,
    };
  }
}
