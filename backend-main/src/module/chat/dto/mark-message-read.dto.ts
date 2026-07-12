import { IsArray, IsString } from 'class-validator';

export class MarkMessageReadDto {
  @IsString()
  callSessionId!: string;

  @IsArray()
  @IsString({
    each: true,
  })
  messageIds!: string[];
}