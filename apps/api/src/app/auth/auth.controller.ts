import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthResult, AuthService, AuthUser } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RequestTenantMembershipDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './optional-auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  /** Who am I? Used by the SPA to restore a session on reload. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUser> {
    return this.auth.updateProfile(user.id, dto);
  }

  @Get('tenant-membership')
  @UseGuards(JwtAuthGuard)
  membership(@CurrentUser() user: AuthUser) {
    return this.auth.membership(user.id);
  }

  @Post('tenant-membership')
  @UseGuards(JwtAuthGuard)
  requestMembership(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestTenantMembershipDto,
  ) {
    return this.auth.requestTenantMembership(user.id, dto);
  }
}
