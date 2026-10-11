import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkGooglePhoneDto {
  @IsString()
  @IsNotEmpty()
  googleAccessToken!: string;

  @IsString()
  @IsNotEmpty()
  firebaseIdToken!: string;

  @IsOptional()
  @IsBoolean()
  confirmAccountLink?: boolean;
}
