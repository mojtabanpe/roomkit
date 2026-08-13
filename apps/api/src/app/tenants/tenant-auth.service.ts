import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { TenantLoginDto } from './dto/tenant-auth.dto';

export interface TenantSession {
  id: string;
  email: string;
  key: string;
  name: string;
}

export interface TenantAuthResult {
  token: string;
  tenant: TenantSession;
}

@Injectable()
export class TenantAuthService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: TenantLoginDto): Promise<TenantAuthResult> {
    const tenant = await this.tenants.findOne({
      where: { email: dto.email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        key: true,
        name: true,
        active: true,
        passwordHash: true,
      },
    });
    const valid =
      !!tenant?.passwordHash &&
      (await bcrypt.compare(dto.password, tenant.passwordHash));
    if (!valid || !tenant.active) {
      throw new UnauthorizedException('ایمیل یا رمز عبور درست نیست.');
    }
    const session = this.toSession(tenant);
    return {
      token: this.jwt.sign({ sub: tenant.id, kind: 'tenant' }),
      tenant: session,
    };
  }

  async findById(id: string): Promise<TenantSession | null> {
    const tenant = await this.tenants.findOne({ where: { id, active: true } });
    return tenant?.email ? this.toSession(tenant) : null;
  }

  private toSession(tenant: Tenant): TenantSession {
    return {
      id: tenant.id,
      email: tenant.email ?? '',
      key: tenant.key,
      name: tenant.name,
    };
  }
}
