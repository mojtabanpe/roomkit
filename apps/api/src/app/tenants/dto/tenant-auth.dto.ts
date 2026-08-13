import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TenantLoginDto {
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور را وارد کنید.' })
  @MaxLength(128)
  password!: string;
}
