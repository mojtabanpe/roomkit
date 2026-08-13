import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { Tenant } from '../database/entities/tenant.entity';
import {
  AddTenantMembersDto,
  DecideTenantMembershipDto,
} from './dto/tenant-portal.dto';
import { TenantSession } from './tenant-auth.service';
import { TenantMembershipsService } from './tenant-memberships.service';
import { TenantRoomPolicyService } from './tenant-room-policy.service';
import {
  CurrentTenantSession,
  TenantSessionGuard,
} from './tenant-session.guard';

@Controller('tenant-portal')
@UseGuards(TenantSessionGuard)
export class TenantPortalController {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantBalance)
    private readonly balances: Repository<TenantBalance>,
    private readonly memberships: TenantMembershipsService,
    private readonly policies: TenantRoomPolicyService,
  ) {}

  @Get('overview')
  async overview(@CurrentTenantSession() session: TenantSession) {
    const tenant = await this.tenants.findOneByOrFail({ id: session.id });
    const balance = await this.balances.findOne({
      where: { tenantId: tenant.id },
    });
    const includedUnits = balance?.includedUnits ?? 0;
    const usedUnits = balance?.usedUnits ?? 0;
    const creditLimitUnits = balance?.creditLimitUnits ?? 0;
    return {
      tenant: { name: tenant.name, key: tenant.key, active: tenant.active },
      subscription: {
        planMode: tenant.planMode,
        includedUnits,
        usedUnits,
        creditLimitUnits,
        remainingUnits:
          tenant.planMode === 'unlimited'
            ? null
            : includedUnits + creditLimitUnits - usedUnits,
      },
      roomLimits: this.policies.limits(tenant),
    };
  }

  @Get('members')
  members(@CurrentTenantSession() tenant: TenantSession) {
    return this.memberships.list(tenant.id);
  }

  @Post('members')
  addMembers(
    @CurrentTenantSession() tenant: TenantSession,
    @Body() dto: AddTenantMembersDto,
  ) {
    return this.memberships.add(tenant.id, dto.usernames);
  }

  @Patch('membership-requests/:userId')
  decide(
    @CurrentTenantSession() tenant: TenantSession,
    @Param('userId') userId: string,
    @Body() dto: DecideTenantMembershipDto,
  ) {
    return this.memberships.decide(tenant.id, userId, dto.decision);
  }

  @Delete('members/:userId')
  async remove(
    @CurrentTenantSession() tenant: TenantSession,
    @Param('userId') userId: string,
  ): Promise<{ ok: true }> {
    await this.memberships.remove(tenant.id, userId);
    return { ok: true };
  }
}
