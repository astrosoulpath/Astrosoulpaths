import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['customer', 'astrologer', 'joinAstrologer'])
  portal?: 'customer' | 'astrologer' | 'joinAstrologer';
}
