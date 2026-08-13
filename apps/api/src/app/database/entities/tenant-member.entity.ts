import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

export type TenantMemberStatus = 'pending' | 'active' | 'rejected';
export type TenantMemberSource = 'tenant' | 'user';

@Entity('tenant_members')
@Index(['tenantId', 'userId'], { unique: true })
@Index('ux_tenant_members_active_user', ['userId'], {
  unique: true,
  where: '"status" = \'active\'',
})
export class TenantMember {
  @PrimaryColumn('uuid') tenantId!: string;
  @PrimaryColumn('uuid') userId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: TenantMemberStatus;

  @Column({ type: 'varchar', length: 16, default: 'tenant' })
  source!: TenantMemberSource;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
