import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  room!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  identity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}
