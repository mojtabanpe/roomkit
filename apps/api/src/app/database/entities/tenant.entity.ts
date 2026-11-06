import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ApiKey } from './api-key.entity';

/**
 * How a tenant is allowed to spend.
 *
 * - `unlimited`   — never blocked, usage is still recorded so we can invoice.
 * - `pay_as_you_go` — blocked only past the credit limit, then billed after.
 * - `prepaid`     — spends a balance that has to be topped up first.
 */
export type PlanMode = 'unlimited' | 'pay_as_you_go' | 'prepaid';

/**
 * A platform that embeds roomkit behind its own UI. Its rooms and its usage are
 * scoped to it, and it authenticates with an API key rather than a user login.
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Short handle that prefixes every LiveKit room name this tenant owns, so two
   * tenants can pick the same slug without landing in one another's call. Kept
   * small on purpose — it is spent from the room name's length budget.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  key!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Tenant credentials are independent from normal roomkit users. */
  @Index('ux_tenants_email', { unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'prepaid' })
  planMode!: PlanMode;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** Hard ceiling applied to every room this tenant creates. Null = no cap. */
  @Column({ type: 'int', nullable: true })
  maxParticipants!: number | null;

  /**
   * How long one call may run before it is cut, in seconds. Only `prepaid`
   * plans are capped at all; this overrides the 30-minute default for tenants
   * whose sessions are legitimately longer — a school period is 90 minutes.
   * Null falls back to `FREE_ROOM_LIMITS.maxDurationSeconds`.
   */
  @Column({ type: 'int', nullable: true })
  maxSessionSeconds!: number | null;

  /**
   * Where to POST room events (`participant_joined`, `participant_left`,
   * `room_finished`, `recording_ready`). Null means the tenant does not want
   * them and none are attempted.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  webhookUrl!: string | null;

  /** HMAC-SHA256 key for the `X-Roomkit-Signature` header on those posts. */
  @Column({ type: 'varchar', length: 100, nullable: true, select: false })
  webhookSecret!: string | null;

  @OneToMany('ApiKey', 'tenant')
  apiKeys!: ApiKey[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
