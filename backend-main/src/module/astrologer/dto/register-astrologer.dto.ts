import { Gender } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator';

export class RegisterAstrologerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  gender?: Gender;

  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @IsArray()
  @IsString({ each: true })
  expertise: string[];

  @IsNumber()
  @Min(0)
  experienceYears: number;

  @IsNumber()
  @Min(0)
  consultationPrice: number;

  @IsOptional()
  @IsString()
  bio?: string;
}