import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Room } from './room.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stored lower-cased so lookups are case-insensitive. */
  @Index('ux_users_username', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  /** Public handle used by tenants when importing or assigning members. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  username!: string;

  @Column({ type: 'varchar', length: 64 })
  displayName!: string;

  /** bcrypt hash — never selected unless explicitly asked for. */
  @Column({ type: 'varchar', length: 100, select: false })
  passwordHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => Room, (room) => room.owner)
  rooms!: Room[];
}
