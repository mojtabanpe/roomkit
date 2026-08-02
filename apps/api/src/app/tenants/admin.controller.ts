import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlanMode } from '../database/entities/tenant.entity';
import { AdminGuard } from './admin.guard';
import {
  IssuedKey,
  TenantDetail,
  TenantSummary,
  TenantsService,
} from './tenants.service';

const PLAN_MODES: PlanMode[] = ['unlimited', 'pay_as_you_go', 'prepaid'];

class CreateTenantDto {
  /** Prefixes the tenant's LiveKit room names, so it has to stay short. */
  @IsString()
  @Matches(/^[a-z0-9-]{2,12}$/, {
    message: 'کلید مستأجر فقط حروف کوچک لاتین، رقم و خط تیره (۲ تا ۱۲ نویسه).',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(PLAN_MODES)
  planMode!: PlanMode;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  maxParticipants?: number;
}

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(PLAN_MODES)
  planMode?: PlanMode;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class IssueKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

class UnitsDto {
  /** Billable seconds. 60 units = one participant-minute. */
  @IsInt()
  @Min(0)
  units!: number;
}

/**
 * Tenant onboarding. Guarded by a shared `ADMIN_TOKEN`, not a user login —
 * there is no admin UI yet and this is the smallest thing that is not open.
 */
@Controller('admin/tenants')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(): Promise<TenantSummary[]> {
    return this.tenants.listTenants();
  }

  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<TenantSummary> {
    if (await this.tenants.findByKey(dto.key)) {
      throw new ConflictException('این کلید مستأجر قبلاً گرفته شده است.');
    }
    const tenant = await this.tenants.createTenant(dto);
    return this.tenants.getTenant(tenant.id);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<TenantDetail> {
    return this.tenants.getTenant(id);
  }

  /** Switching a platform to `unlimited` or capping it happens here. */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantSummary> {
    return this.tenants.updateTenant(id, dto);
  }

  /** The response carries the only copy of the key that will ever exist. */
  @Post(':id/keys')
  issueKey(
    @Param('id') id: string,
    @Body() dto: IssueKeyDto,
  ): Promise<IssuedKey> {
    return this.tenants.issueKey(id, dto.label ?? 'default');
  }

  @Delete(':id/keys/:keyId')
  async revokeKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ): Promise<{ ok: true }> {
    await this.tenants.revokeKey(id, keyId);
    return { ok: true };
  }

  @Post(':id/balance/top-up')
  topUp(@Param('id') id: string, @Body() dto: UnitsDto) {
    return this.tenants.topUp(id, dto.units);
  }

  @Post(':id/balance/credit-limit')
  creditLimit(@Param('id') id: string, @Body() dto: UnitsDto) {
    return this.tenants.setCreditLimit(id, dto.units);
  }
}
