import { IsNumber, IsString } from 'class-validator';

export class StartCallDto {
  @IsString()
  astrologerId: string;

  @IsNumber()
  minutes: number;
}
