import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class MarkMessageReadDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  callSessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', {
    each: true,
  })
  messageIds!: string[];
}