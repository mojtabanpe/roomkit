import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthUser {
  id: string;
  email: string;
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
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();

    if (await this.users.existsBy({ email })) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است.');
    }

    const user = this.users.create({
      email,
      displayName: dto.displayName.trim(),
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    });
    await this.users.save(user);

    return this.sign(user);
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

    return this.sign(user);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? this.toAuthUser(user) : null;
  }

  private sign(user: User): AuthResult {
    const payload = { sub: user.id, email: user.email };
    return { token: this.jwt.sign(payload), user: this.toAuthUser(user) };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
