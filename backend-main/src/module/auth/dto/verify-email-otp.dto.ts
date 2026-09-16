import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class VerifyEmailOtpDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({
    message: 'Email is required',
  })
  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address',
    },
  )
  @MaxLength(254, {
    message: 'Email address is too long',
  })
  email!: string;

  @IsString()
  @IsNotEmpty({
    message: 'OTP is required',
  })
  @Matches(/^\d{4,8}$/, {
    message: 'OTP must contain 4 to 8 digits',
  })
  token!: string;
}
