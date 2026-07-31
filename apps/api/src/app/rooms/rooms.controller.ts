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
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, OptionalAuth } from '../auth/optional-auth.decorator';
import { Room } from '../database/entities/room.entity';

class CreateRoomDto {
  /** Latin, Persian letters and digits — mirrors the client-side slug rule. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9؀-ۿ-]+$/u, {
    message: 'نشانی اتاق فقط می‌تواند حرف، رقم و خط تیره داشته باشد.',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
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
    if (await this.rooms.existsBy({ slug: dto.slug })) {
      throw new ConflictException('این اتاق قبلاً ثبت شده است.');
    }
    const room = this.rooms.create({
      slug: dto.slug,
      name: dto.name,
      ownerId: user.id,
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

  /** Public lookup so the join form can show a saved room's real name. */
  @Get(':slug')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard)
  async bySlug(@Param('slug') slug: string) {
    const room = await this.rooms.findOne({ where: { slug } });
    if (!room) throw new NotFoundException('اتاق ثبت‌شده‌ای با این نشانی نیست.');
    return { slug: room.slug, name: room.name };
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    const room = await this.rooms.findOne({ where: { slug } });
    if (!room) throw new NotFoundException('اتاق پیدا نشد.');
    if (room.ownerId !== user.id) {
      throw new ForbiddenException('این اتاق متعلق به شما نیست.');
    }
    await this.rooms.remove(room);
    return { ok: true };
  }
}
