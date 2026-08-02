import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ROOM_SLUG_MESSAGE, ROOM_SLUG_PATTERN } from '../../rooms/slug';

export class JoinTokenDto {
  /**
   * Constrained to the slug alphabet, which excludes `~`. That exclusion is
   * load-bearing: `~` is what namespaces a tenant's rooms, so without it a
   * guest could name `acme~standup` here and walk into a paying customer's
   * call through the free first-party endpoint.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(ROOM_SLUG_PATTERN, { message: ROOM_SLUG_MESSAGE })
  room!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  identity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  /** Required when the room is private. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  passcode?: string;
}
