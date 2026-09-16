import { IsEnum } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class AdminUpdateSupportStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}
