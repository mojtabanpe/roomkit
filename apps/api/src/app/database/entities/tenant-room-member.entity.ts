import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';

@Entity('tenant_room_members')
export class TenantRoomMember {
  @PrimaryColumn('uuid') roomId!: string;
  @PrimaryColumn('uuid') userId!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room!: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
