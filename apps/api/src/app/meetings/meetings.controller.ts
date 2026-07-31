import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, OptionalAuth } from '../auth/optional-auth.decorator';
import { ChatMessageDto, MeetingsService } from './meetings.service';
import { RoomClaims, RoomCtx, RoomTokenGuard } from './room-token.guard';

class SendMessageDto {
  /** Minted by the sender so the stored copy matches the realtime one. */
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}

/**
 * Everything here is authorised by the LiveKit room token (`X-Room-Token`), so
 * guests work too. A signed-in user additionally gets their messages and
 * sessions linked to their account via `@OptionalAuth`.
 */
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get('messages')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard, RoomTokenGuard)
  history(@RoomCtx() claims: RoomClaims): Promise<ChatMessageDto[]> {
    return this.meetings.history(claims.room);
  }

  @Post('messages')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard, RoomTokenGuard)
  send(
    @RoomCtx() claims: RoomClaims,
    @Body() dto: SendMessageDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<ChatMessageDto> {
    return this.meetings.addMessage(claims, dto.id, dto.body, user?.id ?? null);
  }

  @Post('sessions')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard, RoomTokenGuard)
  start(
    @RoomCtx() claims: RoomClaims,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ id: string }> {
    return this.meetings.startSession(claims, user?.id ?? null);
  }

  @Post('sessions/:id/leave')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard, RoomTokenGuard)
  async end(
    @RoomCtx() claims: RoomClaims,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.meetings.endSession(claims, id);
    return { ok: true };
  }

  /** Recent rooms for the signed-in user. */
  @Get('recent')
  @UseGuards(JwtAuthGuard)
  recent(@CurrentUser() user: AuthUser) {
    return this.meetings.recentForUser(user.id);
  }
}
