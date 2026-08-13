import { ApiKey } from './api-key.entity';
import { MeetingSession } from './meeting-session.entity';
import { Message } from './message.entity';
import { Room } from './room.entity';
import { TenantBalance } from './tenant-balance.entity';
import { Tenant } from './tenant.entity';
import { TenantMember } from './tenant-member.entity';
import { TenantRoomMember } from './tenant-room-member.entity';
import { UsageEvent } from './usage-event.entity';
import { User } from './user.entity';

/**
 * The whole schema, in one list. Kept apart from `database.module.ts` so the
 * migration CLI's DataSource can import it without pulling a Nest module in.
 */
export const ENTITIES = [
  User,
  Room,
  Message,
  MeetingSession,
  Tenant,
  TenantMember,
  TenantRoomMember,
  ApiKey,
  TenantBalance,
  UsageEvent,
];
