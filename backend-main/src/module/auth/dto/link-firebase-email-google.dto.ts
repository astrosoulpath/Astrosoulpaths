import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class LinkFirebaseEmailGoogleDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsBoolean()
  confirmAccountLink!: boolean;
}
