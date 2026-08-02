import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../database/entities/room.entity';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [LivekitController],
  providers: [LivekitService],
  exports: [LivekitService],
})
export class LivekitModule {}
