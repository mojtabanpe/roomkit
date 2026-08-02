import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../database/entities/api-key.entity';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { ApiKeyGuard } from './api-key.guard';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, ApiKey, TenantBalance])],
  controllers: [AdminController],
  providers: [TenantsService, ApiKeyGuard, AdminGuard],
  exports: [TenantsService, ApiKeyGuard],
})
export class TenantsModule {}
