import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
import { Repository } from 'typeorm';
import { Room, RoomVisibility } from '../database/entities/room.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { JoinTokenResponse, LivekitService } from '../livekit/livekit.service';
import { ROOM_SLUG_MESSAGE, ROOM_SLUG_PATTERN } from '../rooms/slug';
import { ApiKeyGuard, CurrentTenant } from '../tenants/api-key.guard';
import { livekitRoomName } from '../tenants/room-name';
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

interface RoomView {
  slug: string;
  name: string;
  visibility: RoomVisibility;
  hasPasscode: boolean;
  maxParticipants: number | null;
  livekitRoom: string;
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
  ) {}

  @Get('usage')
  usageSummary(@CurrentTenant() tenant: Tenant): Promise<BalanceView> {
    return this.usage.balanceOf(tenant);
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
        maxParticipants: dto.maxParticipants ?? tenant.maxParticipants,
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

    if (!(await this.usage.canAdmit(tenant))) {
      throw new HttpException(
        'اعتبار این حساب تمام شده است.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const livekitRoom = livekitRoomName(tenant.key, room.slug);
    // Create it first so the participant cap is the server's, not the client's.
    await this.livekit.ensureRoom(livekitRoom, room.maxParticipants);

    return this.livekit.createJoinToken({
      room: livekitRoom,
      identity: dto.identity,
      name: dto.name,
      canPublish: dto.canPublish,
    });
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
      maxParticipants: room.maxParticipants,
      livekitRoom: livekitRoomName(tenant.key, room.slug),
      createdAt: room.createdAt,
    };
  }
}
