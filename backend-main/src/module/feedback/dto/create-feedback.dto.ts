import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FeedbackCategory } from '@prisma/client';

export class CreateFeedbackDto {
  @IsOptional() @IsString() @MaxLength(120) consultationId?:string;
  @IsEnum(FeedbackCategory)
  category!: FeedbackCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;
}
