import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One participant's stay in one room — powers "recent meetings". */
@Entity('meeting_sessions')
@Index(['roomSlug', 'joinedAt'])
export class MeetingSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  roomSlug!: string;

  @Column({ type: 'varchar', length: 64 })
  identity!: string;

  @Column({ type: 'varchar', length: 64 })
  displayName!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  leftAt!: Date | null;
}
