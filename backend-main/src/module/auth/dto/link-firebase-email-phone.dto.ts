import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkFirebaseEmailPhoneDto {
  @IsString()
  @IsNotEmpty()
  firebaseEmailToken!: string;

  @IsString()
  @IsNotEmpty()
  firebasePhoneToken!: string;

  @IsOptional()
  @IsBoolean()
  confirmAccountLink?: boolean;
}
