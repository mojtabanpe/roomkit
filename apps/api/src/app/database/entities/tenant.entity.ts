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

  @Column({ type: 'varchar', length: 16, default: 'prepaid' })
  planMode!: PlanMode;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** Hard ceiling applied to every room this tenant creates. Null = no cap. */
  @Column({ type: 'int', nullable: true })
  maxParticipants!: number | null;

  @OneToMany('ApiKey', 'tenant')
  apiKeys!: ApiKey[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
