import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PUBLIC_PLAN_CODES = ['free', 'pro', 'usage'] as const;
export type PublicPlanCode = (typeof PUBLIC_PLAN_CODES)[number];

export class CreateTenantWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'نام فروشگاه را وارد کنید.' })
  @MinLength(2, { message: 'نام فروشگاه باید حداقل ۲ نویسه باشد.' })
  @MaxLength(120)
  tenantName!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9-]{2,12}$/, {
    message:
      'شناسه فروشگاه فقط حروف کوچک لاتین، رقم و خط تیره (۲ تا ۱۲ نویسه) است.',
  })
  tenantKey!: string;

  @IsIn(PUBLIC_PLAN_CODES, { message: 'پلن انتخاب‌شده معتبر نیست.' })
  plan!: PublicPlanCode;
}

export class RegisterTenantDto extends CreateTenantWorkspaceDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' })
  @MaxLength(128)
  password!: string;
}
