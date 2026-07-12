import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UploadChatFileDto {
  @IsString()
  @MinLength(1)
  callSessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}