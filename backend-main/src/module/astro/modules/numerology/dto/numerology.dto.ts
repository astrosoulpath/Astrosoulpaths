import { IsString, IsOptional, IsIn, Matches } from 'class-validator';

export class NumerologyDto {
  @IsString()
  fullName: string;

  // 🔥 Enforce YYYY-MM-DD format
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be in YYYY-MM-DD format',
  })
  dateOfBirth: string;

  // 🌐 Language support
  @IsOptional()
  @IsIn(['en', 'hi'])
  lang?: string;
}
