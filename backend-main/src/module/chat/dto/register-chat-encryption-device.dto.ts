import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisterChatEncryptionDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  publicKey!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  keyVersion?: number;
}
