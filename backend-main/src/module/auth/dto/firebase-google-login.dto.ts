import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FirebaseGoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['customer', 'astrologer', 'joinAstrologer'])
  portal?: 'customer' | 'astrologer' | 'joinAstrologer';
}
