import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantMember } from '../database/entities/tenant-member.entity';
import { User } from '../database/entities/user.entity';

export interface TenantMemberView {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: TenantMember['status'];
  source: TenantMember['source'];
  createdAt: Date;
}

@Injectable()
export class TenantMembershipsService {
  constructor(
    @InjectRepository(TenantMember)
    private readonly members: Repository<TenantMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(tenantId: string): Promise<TenantMemberView[]> {
    const memberships = await this.members.find({
      where: { tenantId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return memberships.map((member) => this.view(member));
  }

  async add(
    tenantId: string,
    rawUsernames: string[],
  ): Promise<{
    added: TenantMemberView[];
    notFound: string[];
    unavailable: string[];
  }> {
    const usernames = [
      ...new Set(rawUsernames.map((item) => item.trim().toLowerCase())),
    ];
    const users = await this.users.find({ where: { username: In(usernames) } });
    const byUsername = new Map(users.map((user) => [user.username, user]));
    const notFound = usernames.filter((username) => !byUsername.has(username));
    const added: TenantMemberView[] = [];
    const unavailable: string[] = [];

    for (const username of usernames) {
      const user = byUsername.get(username);
      if (!user) continue;
      const active = await this.members.findOne({
        where: { userId: user.id, status: 'active' },
      });
      if (active && active.tenantId !== tenantId) {
        unavailable.push(username);
        continue;
      }
      let membership = await this.members.findOne({
        where: { tenantId, userId: user.id },
      });
      membership ??= this.members.create({ tenantId, userId: user.id });
      membership.status = 'active';
      membership.source = 'tenant';
      membership.respondedAt = new Date();
      membership.user = user;
      await this.members.save(membership);
      added.push(this.view(membership));
    }
    return { added, notFound, unavailable };
  }

  async decide(
    tenantId: string,
    userId: string,
    decision: 'approve' | 'reject',
  ): Promise<TenantMemberView> {
    const membership = await this.members.findOne({
      where: { tenantId, userId, status: 'pending', source: 'user' },
      relations: { user: true },
    });
    if (!membership) throw new NotFoundException('درخواست عضویت پیدا نشد.');
    if (decision === 'approve') {
      const active = await this.members.findOne({
        where: { userId, status: 'active' },
      });
      if (active && active.tenantId !== tenantId) {
        throw new ConflictException('این کاربر عضو tenant دیگری است.');
      }
    }
    membership.status = decision === 'approve' ? 'active' : 'rejected';
    membership.respondedAt = new Date();
    await this.members.save(membership);
    return this.view(membership);
  }

  async remove(tenantId: string, userId: string): Promise<void> {
    const result = await this.members.delete({ tenantId, userId });
    if (!result.affected) throw new NotFoundException('عضو پیدا نشد.');
  }

  private view(member: TenantMember): TenantMemberView {
    return {
      id: member.user.id,
      username: member.user.username,
      email: member.user.email,
      displayName: member.user.displayName,
      status: member.status,
      source: member.source,
      createdAt: member.createdAt,
    };
  }
}
