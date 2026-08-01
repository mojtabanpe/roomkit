import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingSession } from './entities/meeting-session.entity';
import { Message } from './entities/message.entity';
import { Room } from './entities/room.entity';
import { User } from './entities/user.entity';

export const ENTITIES = [User, Room, Message, MeetingSession];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: ENTITIES,
        // Auto-schema outside production. Production defaults to off — but the
        // first deploy has no migrations to run against an empty database, so
        // DB_SYNCHRONIZE=true is the documented one-time escape hatch until
        // generated migrations exist (see AGENTS.md → Deployment).
        synchronize:
          config.get<string>('NODE_ENV') !== 'production' ||
          config.get<string>('DB_SYNCHRONIZE') === 'true',
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
