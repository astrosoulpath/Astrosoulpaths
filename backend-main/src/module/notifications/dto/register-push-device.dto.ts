import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  deviceId?: string;
}
