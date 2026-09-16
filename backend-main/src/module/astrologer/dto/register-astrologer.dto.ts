import { Gender } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AstrologerDocumentDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}

export class AstrologerDocumentsDto {
  @IsOptional()
  @IsObject()
  identityProof?: {
    type: string;
    name: string;
    url: string;
  };

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AstrologerDocumentDto)
  certificates?: AstrologerDocumentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AstrologerDocumentDto)
  experienceProofs?: AstrologerDocumentDto[];
}

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
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consultationCategories?: string[];

  @IsNumber()
  @Min(0)
  experienceYears: number;

  @IsNumber()
  @Min(0)
  consultationPrice: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AstrologerDocumentsDto)
  documents?: AstrologerDocumentsDto;
}
