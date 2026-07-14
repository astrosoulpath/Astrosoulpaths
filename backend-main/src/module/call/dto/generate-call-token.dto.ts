import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class GenerateCallTokenDto {
  @IsString()
  @IsNotEmpty()
  callId!: string;
}