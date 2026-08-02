import {
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { Room } from '../database/entities/room.entity';
import { JoinTokenDto } from './dto/join-token.dto';
import { JoinTokenResponse, LivekitService } from './livekit.service';

@Controller('livekit')
export class LivekitController {
  constructor(
    private readonly livekit: LivekitService,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
  ) {}

  /**
   * Issue a join token for a participant. The frontend calls this before
   * connecting to the LiveKit room.
   *
   * This is the *first-party* path — guests, no API key, nobody billed. It can
   * only ever reach rooms with no tenant: the DTO forbids the `~` that
   * namespaces tenant rooms, and the lookup below is scoped to
   * `tenantId IS NULL`.
   */
  @Post('token')
  async token(@Body() dto: JoinTokenDto): Promise<JoinTokenResponse> {
    const room = await this.rooms.findOne({
      where: { slug: dto.room, tenantId: IsNull() },
    });

    // No row means an ad-hoc room nobody has claimed — those stay open.
    if (room?.visibility === 'private') {
      const ok =
        !!room.passcodeHash &&
        !!dto.passcode &&
        (await bcrypt.compare(dto.passcode, room.passcodeHash));
      if (!ok) throw new ForbiddenException('رمز اتاق درست نیست.');
    }

    return this.livekit.createJoinToken({
      room: dto.room,
      identity: dto.identity,
      name: dto.name,
    });
  }
}
