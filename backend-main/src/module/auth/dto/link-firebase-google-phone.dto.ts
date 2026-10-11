import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class LinkFirebaseGooglePhoneDto {
  @IsString()
  @IsNotEmpty()
  firebaseGoogleIdToken!: string;

  @IsString()
  @IsNotEmpty()
  firebasePhoneIdToken!: string;

  @IsBoolean()
  confirmAccountLink!: boolean;
}
