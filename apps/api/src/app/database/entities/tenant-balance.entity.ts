import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

/**
 * A tenant's spendable balance, all in billable seconds.
 *
 * `usedUnits` is charged forward while calls are still running (see
 * `UsageService`'s sweep), not only when they end. Charging on `participant_left`
 * alone would let one tenant with an empty balance hold an open room for hours
 * before anything noticed.
 */
@Entity('tenant_balances')
export class TenantBalance {
  @PrimaryColumn({ type: 'uuid' })
  tenantId!: string;

  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /** Topped up for prepaid tenants; the monthly allowance for the others. */
  @Column({ type: 'int', default: 0 })
  includedUnits!: number;

  @Column({ type: 'int', default: 0 })
  usedUnits!: number;

  /** How far past the allowance a pay-as-you-go tenant may run before we stop. */
  @Column({ type: 'int', default: 0 })
  creditLimitUnits!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
