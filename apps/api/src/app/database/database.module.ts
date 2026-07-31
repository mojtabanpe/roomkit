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
        // Fine for this stage; switch to generated migrations before deploying.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
