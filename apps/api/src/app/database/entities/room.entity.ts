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
import { User } from './user.entity';

/** Public rooms are joinable by slug alone; private ones need the passcode. */
export type RoomVisibility = 'public' | 'private';

/**
 * A room that has been claimed — by a roomkit user, or by a tenant platform.
 * Rooms are still created on demand by LiveKit; a row here only means someone
 * owns the slug and it survives.
 *
 * Exactly one of `ownerId` / `tenantId` is set. Both are nullable because the
 * two owners are different kinds of thing, and the uniqueness rules differ with
 * them: a tenant's slugs only have to be unique *within* that tenant, while
 * first-party slugs share one global namespace.
 */
@Entity('rooms')
@Index('ux_rooms_tenant_slug', ['tenantId', 'slug'], { unique: true })
// Postgres treats every NULL as distinct, so the composite index above does not
// constrain first-party rooms at all. This partial index is what keeps them
// unique.
@Index('ux_rooms_first_party_slug', ['slug'], {
  unique: true,
  where: '"tenantId" IS NULL',
})
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @ManyToOne(() => User, (user) => user.rooms, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'ownerId' })
  owner!: User | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant | null;

  @Column({ type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'public' })
  visibility!: RoomVisibility;

  /** bcrypt, like user passwords — a passcode is short enough to be guessed. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  passcodeHash!: string | null;

  @Column({ type: 'int', nullable: true })
  maxParticipants!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
