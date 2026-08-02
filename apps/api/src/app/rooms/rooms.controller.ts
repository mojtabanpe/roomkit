import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, OptionalAuth } from '../auth/optional-auth.decorator';
import { Room, RoomVisibility } from '../database/entities/room.entity';
import { ROOM_SLUG_MESSAGE, ROOM_SLUG_PATTERN } from './slug';

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
}

@Controller('rooms')
export class RoomsController {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
  ) {}

  /** Claim a permanent room. Requires an account. */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Room> {
    const visibility = dto.visibility ?? 'public';
    if (visibility === 'private' && !dto.passcode) {
      throw new ForbiddenException('اتاق خصوصی بدون رمز ساخته نمی‌شود.');
    }
    // Scoped to first-party rooms: a tenant may own this slug too, and the two
    // namespaces are separate.
    if (await this.rooms.existsBy({ slug: dto.slug, tenantId: IsNull() })) {
      throw new ConflictException('این اتاق قبلاً ثبت شده است.');
    }
    const room = this.rooms.create({
      slug: dto.slug,
      name: dto.name,
      ownerId: user.id,
      tenantId: null,
      visibility,
      passcodeHash: dto.passcode
        ? await bcrypt.hash(dto.passcode, PASSCODE_ROUNDS)
        : null,
    });
    return this.rooms.save(room);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser): Promise<Room[]> {
    return this.rooms.find({
      where: { ownerId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Public lookup so the join form can show a saved room's real name — and now
   * also learn that it has to ask for a passcode before trying to join.
   */
  @Get(':slug')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard)
  async bySlug(@Param('slug') slug: string) {
    const room = await this.rooms.findOne({
      where: { slug, tenantId: IsNull() },
    });
    if (!room) throw new NotFoundException('اتاق ثبت‌شده‌ای با این نشانی نیست.');
    return { slug: room.slug, name: room.name, visibility: room.visibility };
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    const room = await this.rooms.findOne({
      where: { slug, tenantId: IsNull() },
    });
    if (!room) throw new NotFoundException('اتاق پیدا نشد.');
    if (room.ownerId !== user.id) {
      throw new ForbiddenException('این اتاق متعلق به شما نیست.');
    }
    await this.rooms.remove(room);
    return { ok: true };
  }
}
