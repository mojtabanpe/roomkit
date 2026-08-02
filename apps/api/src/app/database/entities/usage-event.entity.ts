import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type UsageKind = 'participant' | 'egress';

/**
 * One billable stay, closed out from LiveKit webhooks.
 *
 * This is deliberately *not* `meeting_sessions`. That table is written by the
 * browser (`RoomService.syncSessionStart`) to power "recent meetings"; a tenant
 * shipping its own UI can simply not call it, so it can never be the basis of
 * an invoice. Usage is only ever recorded from a webhook the LiveKit server
 * signs.
 */
@Entity('usage_events')
@Index(['tenantId', 'startedAt'])
export class UsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Null for first-party (roomkit.ir) traffic, which nobody is billed for. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  tenantId!: string | null;

  /** The namespaced LiveKit room name, not the tenant-facing slug. */
  @Column({ type: 'varchar', length: 128 })
  room!: string;

  @Column({ type: 'varchar', length: 64 })
  identity!: string;

  /**
   * LiveKit's participant sid (or egress id). Unique, which is what makes the
   * webhook handler idempotent — LiveKit retries deliveries and gives no
   * exactly-once guarantee.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  sourceSid!: string;

  @Column({ type: 'varchar', length: 16, default: 'participant' })
  kind!: UsageKind;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  /**
   * Billable seconds charged so far — this grows while the stay is still open.
   * Seconds rather than a `numeric` because pg hands `numeric`/`bigint` back as
   * strings and the arithmetic silently turns into string concatenation.
   */
  @Column({ type: 'int', default: 0 })
  units!: number;

  /**
   * Watermark for the incremental charge: each sweep bills `now - billedUntil`
   * and moves it forward, so a sweep that runs twice cannot double-charge.
   */
  @Column({ type: 'timestamptz' })
  billedUntil!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
