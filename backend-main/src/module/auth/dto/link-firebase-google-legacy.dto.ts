import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class LinkFirebaseGoogleLegacyDto {
  @IsString()
  @IsNotEmpty()
  firebaseIdToken!: string;

  @IsString()
  @IsNotEmpty()
  legacySupabaseAccessToken!: string;

  @IsBoolean()
  confirmAccountLink!: boolean;
}
