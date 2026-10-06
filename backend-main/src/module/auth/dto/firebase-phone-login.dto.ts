import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FirebasePhoneLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['customer', 'astrologer', 'joinAstrologer', 'admin'])
  portal?: 'customer' | 'astrologer' | 'joinAstrologer' | 'admin';
}
