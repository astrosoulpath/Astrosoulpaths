import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedPhone = value.trim();

    if (trimmedPhone.startsWith('+')) {
      return `+${trimmedPhone.slice(1).replace(/\D/g, '')}`;
    }

    return trimmedPhone.replace(/\D/g, '');
  })
  @IsNotEmpty({
    message: 'phone is required',
  })
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'phone must include country code in international format, for example +919999999999',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty({
    message: 'OTP is required',
  })
  @Matches(/^\d{4,8}$/, {
    message: 'OTP must contain 4 to 8 digits',
  })
  token!: string;
}