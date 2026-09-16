import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAstrologerKundliReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  character?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  career?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  marriage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  finance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  health?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  remedies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;
}
