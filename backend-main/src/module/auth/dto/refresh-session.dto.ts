import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshSessionDto {
  @IsString()
  @IsNotEmpty({
    message: 'refreshToken is required',
  })
  refreshToken!: string;

  @IsOptional()
  @IsString()
  @IsIn(['customer', 'astrologer', 'joinAstrologer', 'admin'])
  portal?: 'customer' | 'astrologer' | 'joinAstrologer' | 'admin';
}
