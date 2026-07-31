import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Chat history. Keyed by room slug rather than a FK, because ad-hoc rooms that
 * nobody owns still have chat.
 */
@Entity('messages')
@Index(['roomSlug', 'createdAt'])
export class Message {
  /**
   * Minted by the sender and echoed over the LiveKit stream, so the realtime
   * copy and the stored copy of a message share one id and dedupe cleanly.
   */
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  roomSlug!: string;

  /** LiveKit participant identity — unique within a room, guests included. */
  @Column({ type: 'varchar', length: 64 })
  senderIdentity!: string;

  @Column({ type: 'varchar', length: 64 })
  senderName!: string;

  /** Set when the sender was signed in; null for guests. */
  @Column({ type: 'uuid', nullable: true })
  senderUserId!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
