import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateQualificationQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  optionA?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  optionB?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  optionC?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  optionD?: string;

  @IsOptional()
  @IsString()
  @IsIn(['A', 'B', 'C', 'D'])
  correctOption?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
