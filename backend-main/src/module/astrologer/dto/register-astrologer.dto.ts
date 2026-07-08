import { Gender, AstrologerExpertise } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
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
  @IsEnum(Gender)
  gender?: Gender;

  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @IsArray()
  @IsEnum(AstrologerExpertise, { each: true })
  expertise: AstrologerExpertise[];

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