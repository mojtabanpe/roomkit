import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { UsageEvent } from '../database/entities/usage-event.entity';
import { LivekitModule } from '../livekit/livekit.module';
import { RecordingsModule } from '../recordings/recordings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { LivekitWebhookController } from './livekit-webhook.controller';
import { UsageService } from './usage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsageEvent, TenantBalance]),
    LivekitModule,
    RecordingsModule,
    TenantsModule,
  ],
  controllers: [LivekitWebhookController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
