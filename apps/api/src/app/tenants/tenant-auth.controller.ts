import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantLoginDto } from './dto/tenant-auth.dto';
import {
  TenantAuthResult,
  TenantAuthService,
  TenantSession,
} from './tenant-auth.service';
import {
  CurrentTenantSession,
  TenantSessionGuard,
} from './tenant-session.guard';

@Controller('tenant-auth')
export class TenantAuthController {
  constructor(private readonly auth: TenantAuthService) {}

  @Post('login')
  login(@Body() dto: TenantLoginDto): Promise<TenantAuthResult> {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(TenantSessionGuard)
  me(@CurrentTenantSession() tenant: TenantSession): TenantSession {
    return tenant;
  }
}
