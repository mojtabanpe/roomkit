import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { TenantMember } from '../database/entities/tenant-member.entity';
import { User } from '../database/entities/user.entity';
import {
  LoginDto,
  RegisterDto,
  RequestTenantMembershipDto,
  UpdateProfileDto,
} from './dto/auth.dto';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantMember)
    private readonly members: Repository<TenantMember>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    if (await this.users.exists({ where: [{ email }, { username }] })) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است.');
    }

    const tenant = dto.tenantKey
      ? await this.tenants.findOne({ where: { key: dto.tenantKey } })
      : null;
    if (dto.tenantKey && !tenant) {
      throw new NotFoundException('tenant موردنظر پیدا نشد.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        User,
        manager.create(User, {
          email,
          username,
          displayName: dto.displayName.trim(),
          passwordHash,
        }),
      );
      if (tenant) {
        await manager.save(
          TenantMember,
          manager.create(TenantMember, {
            tenantId: tenant.id,
            userId: created.id,
            status: 'pending',
            source: 'user',
            respondedAt: null,
          }),
        );
      }
      return created;
    });

    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({
      where: { email },
      // passwordHash is `select: false` on the entity — opt back in here only.
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
      },
    });

    // Same message either way — don't leak which emails are registered.
    const ok =
      !!user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!ok) {
      throw new UnauthorizedException('ایمیل یا رمز عبور درست نیست.');
    }

    return this.issue(user);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? this.toAuthUser(user) : null;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<AuthUser> {
    const username = dto.username.trim().toLowerCase();
    const duplicate = await this.users.findOne({ where: { username } });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException('این نام کاربری قبلاً گرفته شده است.');
    }
    const user = await this.users.findOneByOrFail({ id });
    user.username = username;
    user.displayName = dto.displayName.trim();
    return this.toAuthUser(await this.users.save(user));
  }

  async requestTenantMembership(
    userId: string,
    dto: RequestTenantMembershipDto,
  ): Promise<{
    status: TenantMember['status'];
    tenant: { name: string; key: string };
  }> {
    const tenant = await this.tenants.findOne({
      where: { key: dto.tenantKey.trim().toLowerCase() },
    });
    if (!tenant) throw new NotFoundException('tenant موردنظر پیدا نشد.');

    const active = await this.members.findOne({
      where: { userId, status: 'active' },
    });
    if (active) {
      throw new ConflictException('شما در حال حاضر عضو یک tenant هستید.');
    }

    const existing = await this.members.findOne({
      where: { tenantId: tenant.id, userId },
    });
    if (existing?.status === 'pending') {
      throw new ConflictException('این درخواست قبلاً ارسال شده است.');
    }
    const member =
      existing ?? this.members.create({ tenantId: tenant.id, userId });
    member.status = 'pending';
    member.source = 'user';
    member.respondedAt = null;
    await this.members.save(member);
    return {
      status: member.status,
      tenant: { name: tenant.name, key: tenant.key },
    };
  }

  async membership(userId: string): Promise<{
    status: TenantMember['status'];
    source: TenantMember['source'];
    tenant: { name: string; key: string };
  } | null> {
    const membership = await this.members.findOne({
      where: { userId },
      relations: { tenant: true },
      order: { createdAt: 'DESC' },
    });
    return membership
      ? {
          status: membership.status,
          source: membership.source,
          tenant: { name: membership.tenant.name, key: membership.tenant.key },
        }
      : null;
  }

  /** Shared with transactional onboarding flows that create a user themselves. */
  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /** Mint the normal app session after another feature created the user. */
  issue(user: User): AuthResult {
    const payload = { sub: user.id, email: user.email, kind: 'user' };
    return { token: this.jwt.sign(payload), user: this.toAuthUser(user) };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    };
  }
}
