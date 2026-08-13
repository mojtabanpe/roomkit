import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const TENANT_KEY_PATTERN = /^[a-z0-9-]{2,12}$/;

export class RegisterDto {
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(USERNAME_PATTERN, {
    message:
      'نام کاربری باید ۳ تا ۳۲ نویسه و شامل حروف کوچک لاتین، عدد، خط تیره یا زیرخط باشد.',
  })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'نام را وارد کنید.' })
  @MaxLength(64)
  displayName!: string;

  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(TENANT_KEY_PATTERN, { message: 'شناسه tenant معتبر نیست.' })
  tenantKey?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور را وارد کنید.' })
  @MaxLength(128)
  password!: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'نام را وارد کنید.' })
  @MaxLength(64)
  displayName!: string;

  @IsString()
  @Matches(USERNAME_PATTERN, {
    message:
      'نام کاربری باید ۳ تا ۳۲ نویسه و شامل حروف کوچک لاتین، عدد، خط تیره یا زیرخط باشد.',
  })
  username!: string;
}

export class RequestTenantMembershipDto {
  @IsString()
  @Matches(TENANT_KEY_PATTERN, { message: 'شناسه tenant معتبر نیست.' })
  tenantKey!: string;
}
