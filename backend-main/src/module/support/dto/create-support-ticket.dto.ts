import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupportTicketCategory } from '@prisma/client';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(SupportTicketCategory)
  category?: SupportTicketCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relatedCallSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relatedPaymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relatedWalletTxnId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string;
}

