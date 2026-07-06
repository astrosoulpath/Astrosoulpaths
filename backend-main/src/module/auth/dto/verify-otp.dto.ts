import { IsString, Matches, Length, IsPhoneNumber } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber()
  @Matches(/^\+[1-9]\d{9,14}$/, {
    message: 'Phone must be in valid international format (+123...)',
  })
  phone: string;

  @IsString()
  @Length(6, 6)
  token: string;
}
