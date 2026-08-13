import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ApiKey } from '../database/entities/api-key.entity';
import { Room } from '../database/entities/room.entity';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { TenantMember } from '../database/entities/tenant-member.entity';
import { TenantRoomMember } from '../database/entities/tenant-room-member.entity';
import { User } from '../database/entities/user.entity';
import { UsageEvent } from '../database/entities/usage-event.entity';
import { LivekitModule } from '../livekit/livekit.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { ApiKeyGuard } from './api-key.guard';
import { TenantsService } from './tenants.service';
import { TenantPortalController } from './tenant-portal.controller';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { TenantOnboardingController } from './tenant-onboarding.controller';
import { TenantAuthService } from './tenant-auth.service';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantMembershipsService } from './tenant-memberships.service';
import { TenantRoomsController } from './tenant-rooms.controller';
import { TenantRoomsService } from './tenant-rooms.service';
import { TenantSessionGuard } from './tenant-session.guard';
import { TenantRoomPolicyService } from './tenant-room-policy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      ApiKey,
      TenantBalance,
      TenantMember,
      TenantRoomMember,
      User,
      Room,
      UsageEvent,
    ]),
    AuthModule,
    LivekitModule,
  ],
  controllers: [
    AdminController,
    TenantPortalController,
    TenantOnboardingController,
    TenantAuthController,
    TenantRoomsController,
  ],
  providers: [
    TenantsService,
    ApiKeyGuard,
    AdminGuard,
    TenantOnboardingService,
    TenantAuthService,
    TenantMembershipsService,
    TenantRoomsService,
    TenantRoomPolicyService,
    TenantSessionGuard,
  ],
  exports: [TenantsService, ApiKeyGuard, TenantRoomPolicyService],
})
export class TenantsModule {}
