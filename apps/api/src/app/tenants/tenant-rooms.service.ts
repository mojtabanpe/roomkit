import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.service';
import { Room } from '../database/entities/room.entity';
import { TenantMember } from '../database/entities/tenant-member.entity';
import { TenantRoomMember } from '../database/entities/tenant-room-member.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { JoinTokenResponse, LivekitService } from '../livekit/livekit.service';
import { livekitRoomName } from './room-name';
import { TenantRoomPolicyService } from './tenant-room-policy.service';
import {
  AssignTenantRoomUsersDto,
  CreateTenantRoomDto,
  JoinTenantRoomDto,
} from './dto/tenant-portal.dto';

export interface TenantRoomView {
  slug: string;
  name: string;
  url: string;
  maxParticipants: number | null;
  assignedUsers: number;
  createdAt: Date;
}

@Injectable()
export class TenantRoomsService {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantMember)
    private readonly memberships: Repository<TenantMember>,
    @InjectRepository(TenantRoomMember)
    private readonly roomMembers: Repository<TenantRoomMember>,
    private readonly livekit: LivekitService,
    private readonly policies: TenantRoomPolicyService,
  ) {}

  async list(tenantId: string): Promise<TenantRoomView[]> {
    const tenant = await this.tenant(tenantId);
    const rooms = await this.rooms.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(rooms.map((room) => this.view(tenant, room)));
  }

  async create(
    tenantId: string,
    dto: CreateTenantRoomDto,
  ): Promise<TenantRoomView & { joinKey: string }> {
    const tenant = await this.tenant(tenantId);
    if (await this.rooms.existsBy({ tenantId, slug: dto.slug })) {
      throw new ConflictException('این شناسه روم قبلاً ثبت شده است.');
    }
    const joinKey = randomBytes(6).toString('base64url');
    const room = await this.rooms.save(
      this.rooms.create({
        tenantId,
        ownerId: null,
        slug: dto.slug,
        name: dto.name.trim(),
        visibility: 'private',
        passcodeHash: await bcrypt.hash(joinKey, 12),
        maxParticipants: this.policies.limits(tenant, dto.maxParticipants)
          .maxParticipants,
      }),
    );
    return { ...(await this.view(tenant, room)), joinKey };
  }

  async assign(
    tenantId: string,
    slug: string,
    dto: AssignTenantRoomUsersDto,
  ): Promise<{ assigned: string[]; unavailable: string[] }> {
    const room = await this.room(tenantId, slug);
    const usernames = [
      ...new Set(dto.usernames.map((item) => item.trim().toLowerCase())),
    ];
    const memberships = await this.memberships.find({
      where: { tenantId, status: 'active' },
      relations: { user: true },
    });
    const allowed = new Map(
      memberships.map((member) => [member.user.username, member.user]),
    );
    const assigned: string[] = [];
    const unavailable: string[] = [];
    for (const username of usernames) {
      const user = allowed.get(username);
      if (!user) {
        unavailable.push(username);
        continue;
      }
      await this.roomMembers.upsert({ roomId: room.id, userId: user.id }, [
        'roomId',
        'userId',
      ]);
      assigned.push(username);
    }
    return { assigned, unavailable };
  }

  async assigned(tenantId: string, slug: string) {
    const room = await this.room(tenantId, slug);
    const rows = await this.roomMembers.find({
      where: { roomId: room.id },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName,
    }));
  }

  async publicView(tenantKey: string, slug: string) {
    const tenant = await this.tenants.findOne({
      where: { key: tenantKey, active: true },
    });
    if (!tenant) throw new NotFoundException('tenant پیدا نشد.');
    const room = await this.room(tenant.id, slug);
    return {
      tenant: { name: tenant.name, key: tenant.key },
      room: { name: room.name, slug: room.slug },
    };
  }

  async token(
    tenantKey: string,
    slug: string,
    dto: JoinTenantRoomDto,
    user?: AuthUser,
  ): Promise<JoinTokenResponse> {
    const tenant = await this.tenants.findOne({
      where: { key: tenantKey, active: true },
    });
    if (!tenant) throw new NotFoundException('tenant پیدا نشد.');
    const room = await this.room(tenant.id, slug);
    const assigned = user
      ? (await this.roomMembers.existsBy({
          roomId: room.id,
          userId: user.id,
        })) &&
        (await this.memberships.existsBy({
          tenantId: tenant.id,
          userId: user.id,
          status: 'active',
        }))
      : false;
    const keyValid =
      !!dto.key &&
      !!room.passcodeHash &&
      (await bcrypt.compare(dto.key, room.passcodeHash));
    if (!assigned && !keyValid) {
      throw new ForbiddenException('کلید ورود به روم درست نیست.');
    }
    if (!user && !dto.displayName?.trim()) {
      throw new ForbiddenException('نام خود را وارد کنید.');
    }
    const livekitRoom = livekitRoomName(tenant.key, room.slug);
    const admission = await this.policies.admission(tenant, livekitRoom);
    if ('reason' in admission) {
      throw new HttpException(
        admission.reason === 'duration_exceeded'
          ? 'زمان ۳۰ دقیقه‌ای این جلسه به پایان رسیده است.'
          : 'اعتبار این tenant تمام شده است.',
        admission.reason === 'duration_exceeded'
          ? HttpStatus.GONE
          : HttpStatus.PAYMENT_REQUIRED,
      );
    }
    const limits = this.policies.limits(tenant, room.maxParticipants);
    if (
      limits.maxParticipants !== null &&
      (await this.livekit.activeParticipantCount(livekitRoom)) >=
        limits.maxParticipants
    ) {
      throw new HttpException('ظرفیت این روم تکمیل است.', HttpStatus.CONFLICT);
    }
    await this.livekit.ensureRoom(livekitRoom, limits.maxParticipants);
    return this.livekit.createJoinToken({
      room: livekitRoom,
      identity: user ? `user:${user.id}` : `guest:${randomUUID()}`,
      name: user?.displayName ?? dto.displayName?.trim(),
      limits,
    });
  }

  private async tenant(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id, active: true } });
    if (!tenant) throw new NotFoundException('tenant پیدا نشد.');
    return tenant;
  }

  private async room(tenantId: string, slug: string): Promise<Room> {
    const room = await this.rooms.findOne({ where: { tenantId, slug } });
    if (!room) throw new NotFoundException('روم پیدا نشد.');
    return room;
  }

  private async view(tenant: Tenant, room: Room): Promise<TenantRoomView> {
    return {
      slug: room.slug,
      name: room.name,
      url: `/t/${tenant.key}/${room.slug}`,
      maxParticipants: this.policies.limits(tenant, room.maxParticipants)
        .maxParticipants,
      assignedUsers: await this.roomMembers.countBy({ roomId: room.id }),
      createdAt: room.createdAt,
    };
  }
}
