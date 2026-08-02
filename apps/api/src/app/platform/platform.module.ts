import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../database/entities/room.entity';
import { LivekitModule } from '../livekit/livekit.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsageModule } from '../usage/usage.module';
import { PlatformController } from './platform.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room]),
    LivekitModule,
    TenantsModule,
    UsageModule,
  ],
  controllers: [PlatformController],
})
export class PlatformModule {}
