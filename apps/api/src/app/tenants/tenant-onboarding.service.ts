import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { PlanMode, Tenant } from '../database/entities/tenant.entity';
import { PublicPlanCode, RegisterTenantDto } from './dto/tenant-onboarding.dto';

const FREE_STARTER_UNITS = 10 * 30 * 60;

interface PlanSettings {
  planMode: PlanMode;
  maxParticipants: number | null;
  includedUnits: number;
  creditLimitUnits: number;
}

export interface TenantWorkspaceResult {
  tenant: { name: string; key: string };
  subscription: { plan: PublicPlanCode; planMode: PlanMode };
}

export function settingsForPlan(plan: PublicPlanCode): PlanSettings {
  switch (plan) {
    case 'free':
      return {
        planMode: 'prepaid',
        maxParticipants: 10,
        // Starter allowance keeps the free workspace usable before billing
        // exists: one fully occupied 30-minute session in billable seconds.
        includedUnits: FREE_STARTER_UNITS,
        creditLimitUnits: 0,
      };
    case 'pro':
      return {
        planMode: 'unlimited',
        maxParticipants: 300,
        includedUnits: 0,
        creditLimitUnits: 0,
      };
    case 'usage':
      return {
        planMode: 'pay_as_you_go',
        maxParticipants: null,
        includedUnits: 0,
        creditLimitUnits: 0,
      };
  }
}

@Injectable()
export class TenantOnboardingService {
  constructor(private readonly dataSource: DataSource) {}

  async register(dto: RegisterTenantDto): Promise<TenantWorkspaceResult> {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.dataSource.transaction(async (manager) => {
      if (
        await manager.exists(Tenant, {
          where: [{ email: dto.email }, { key: dto.tenantKey }],
        })
      ) {
        throw new ConflictException(
          'این ایمیل یا شناسه tenant قبلاً ثبت شده است.',
        );
      }

      const settings = settingsForPlan(dto.plan);
      const tenant = await manager.save(
        Tenant,
        manager.create(Tenant, {
          key: dto.tenantKey,
          name: dto.tenantName.trim(),
          email: dto.email,
          passwordHash,
          planMode: settings.planMode,
          maxParticipants: settings.maxParticipants,
        }),
      );
      await manager.save(
        TenantBalance,
        manager.create(TenantBalance, {
          tenantId: tenant.id,
          includedUnits: settings.includedUnits,
          creditLimitUnits: settings.creditLimitUnits,
        }),
      );

      return {
        tenant: { name: tenant.name, key: tenant.key },
        subscription: { plan: dto.plan, planMode: tenant.planMode },
      };
    });
  }
}
