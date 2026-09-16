import { IsBoolean } from 'class-validator';

export class UpdateVideoCallSettingsDto {
  @IsBoolean()
  enabled!: boolean;
}
