import { IsString, MinLength } from 'class-validator';

export class JoinChatDto {
  @IsString()
  @MinLength(1)
  callSessionId!: string;
}