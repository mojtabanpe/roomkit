import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MeetingSession } from '../database/entities/meeting-session.entity';
import { Message } from '../database/entities/message.entity';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { RoomTokenGuard } from './room-token.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Message, MeetingSession]), AuthModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, RoomTokenGuard],
})
export class MeetingsModule {}
