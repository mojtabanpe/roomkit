import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

/**
 * A credential a tenant's *backend* uses. The full key is shown once at
 * creation and never stored — only the prefix (to look the row up) and a hash
 * of the secret half.
 */
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.apiKeys, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /** Public half of the key — safe to log, and what we index lookups on. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  prefix!: string;

  /**
   * sha256 of the secret half. Not bcrypt: the secret is 256 bits of random, so
   * there is no dictionary to slow down, and this runs on every API call.
   */
  @Column({ type: 'varchar', length: 64 })
  secretHash!: string;

  @Column({ type: 'varchar', length: 80, default: 'default' })
  label!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
