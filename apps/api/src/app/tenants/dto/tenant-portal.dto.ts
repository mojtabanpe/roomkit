import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ROOM_SLUG_MESSAGE, ROOM_SLUG_PATTERN } from '../../rooms/slug';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;

export class AddTenantMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Matches(USERNAME_PATTERN, { each: true, message: 'نام کاربری معتبر نیست.' })
  usernames!: string[];
}

export class DecideTenantMembershipDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}

export class CreateTenantRoomDto {
  @IsString()
  @IsNotEmpty()
  @Matches(ROOM_SLUG_PATTERN, { message: ROOM_SLUG_MESSAGE })
  @MaxLength(64)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  maxParticipants?: number;
}

export class AssignTenantRoomUsersDto extends AddTenantMembersDto {}

export class JoinTenantRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;
}
