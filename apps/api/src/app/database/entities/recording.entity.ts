import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * `starting` and `active` come from us; the rest arrive on the `egress_ended`
 * webhook. A row that stays `active` long after the room finished means the
 * webhook never landed — treat it as failed rather than as a file that exists.
 */
export type RecordingStatus =
  | 'starting'
  | 'active'
  | 'complete'
  | 'failed'
  | 'aborted';

/**
 * One recording of one call. The file itself lives on the VPS disk under
 * `RECORDINGS_DIR`, shared between the egress container (which writes it) and
 * the API container (which serves it).
 */
@Entity('recordings')
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_recordings_tenant')
  @Column({ type: 'uuid' })
  tenantId!: string;

  /** The tenant-facing slug, so a platform never sees the namespaced name. */
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  /** Namespaced LiveKit room name, which is what egress and webhooks use. */
  @Index('idx_recordings_room')
  @Column({ type: 'varchar', length: 128 })
  room!: string;

  /** LiveKit's handle for the running job — needed to stop it. */
  @Index('ux_recordings_egress', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  egressId!: string;

  @Column({ type: 'varchar', length: 16, default: 'starting' })
  status!: RecordingStatus;

  /** Path relative to `RECORDINGS_DIR`. Null until the file is finished. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  filePath!: string | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  /** Who pressed record, in the platform's own id space. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  startedByIdentity!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
