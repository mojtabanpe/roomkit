import { Body, Controller, Post } from '@nestjs/common';
import { RegisterTenantDto } from './dto/tenant-onboarding.dto';
import {
  TenantOnboardingService,
  TenantWorkspaceResult,
} from './tenant-onboarding.service';

@Controller('tenant-onboarding')
export class TenantOnboardingController {
  constructor(private readonly onboarding: TenantOnboardingService) {}

  @Post('register')
  register(@Body() dto: RegisterTenantDto): Promise<TenantWorkspaceResult> {
    return this.onboarding.register(dto);
  }
}
