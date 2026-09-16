import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class UploadChatAudioDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  callSessionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 60 * 1000)
  audioDurationMs!: number;
}
