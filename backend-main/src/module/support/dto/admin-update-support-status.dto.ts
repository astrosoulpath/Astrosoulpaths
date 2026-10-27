import { IsEnum,IsOptional,IsString,MaxLength } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class AdminUpdateSupportStatusDto {
  @IsOptional() @IsString() @MaxLength(3000) resolutionNote?:string;
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}
