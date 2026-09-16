import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateQualificationQuestionDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsString()
  @IsNotEmpty()
  optionA!: string;

  @IsString()
  @IsNotEmpty()
  optionB!: string;

  @IsString()
  @IsNotEmpty()
  optionC!: string;

  @IsString()
  @IsNotEmpty()
  optionD!: string;

  @IsString()
  @IsIn(['A', 'B', 'C', 'D'])
  correctOption!: string;

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
