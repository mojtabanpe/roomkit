import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'نام را وارد کنید.' })
  @MaxLength(64)
  displayName!: string;

  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' })
  @MaxLength(128)
  password!: string;
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
