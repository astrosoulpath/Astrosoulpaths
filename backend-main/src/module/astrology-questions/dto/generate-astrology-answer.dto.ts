import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GenerateAstrologyAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  questionId!: string;

  @IsString()
  @IsNotEmpty()
  categorySlug!: string;
}
