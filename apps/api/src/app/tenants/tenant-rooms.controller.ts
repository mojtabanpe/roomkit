import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, OptionalAuth } from '../auth/optional-auth.decorator';
import {
  AssignTenantRoomUsersDto,
  CreateTenantRoomDto,
  JoinTenantRoomDto,
} from './dto/tenant-portal.dto';
import { TenantSession } from './tenant-auth.service';
import { TenantRoomsService } from './tenant-rooms.service';
import {
  CurrentTenantSession,
  TenantSessionGuard,
} from './tenant-session.guard';

@Controller()
export class TenantRoomsController {
  constructor(private readonly rooms: TenantRoomsService) {}

  @Get('tenant-portal/rooms')
  @UseGuards(TenantSessionGuard)
  list(@CurrentTenantSession() tenant: TenantSession) {
    return this.rooms.list(tenant.id);
  }

  @Post('tenant-portal/rooms')
  @UseGuards(TenantSessionGuard)
  create(
    @CurrentTenantSession() tenant: TenantSession,
    @Body() dto: CreateTenantRoomDto,
  ) {
    return this.rooms.create(tenant.id, dto);
  }

  @Post('tenant-portal/rooms/:slug/users')
  @UseGuards(TenantSessionGuard)
  assign(
    @CurrentTenantSession() tenant: TenantSession,
    @Param('slug') slug: string,
    @Body() dto: AssignTenantRoomUsersDto,
  ) {
    return this.rooms.assign(tenant.id, slug, dto);
  }

  @Get('tenant-portal/rooms/:slug/users')
  @UseGuards(TenantSessionGuard)
  assigned(
    @CurrentTenantSession() tenant: TenantSession,
    @Param('slug') slug: string,
  ) {
    return this.rooms.assigned(tenant.id, slug);
  }

  @Get('tenant-rooms/:tenantKey/:slug')
  publicView(
    @Param('tenantKey') tenantKey: string,
    @Param('slug') slug: string,
  ) {
    return this.rooms.publicView(tenantKey, slug);
  }

  @Post('tenant-rooms/:tenantKey/:slug/token')
  @OptionalAuth()
  @UseGuards(JwtAuthGuard)
  token(
    @Param('tenantKey') tenantKey: string,
    @Param('slug') slug: string,
    @Body() dto: JoinTenantRoomDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.rooms.token(tenantKey, slug, dto, user);
  }
}
