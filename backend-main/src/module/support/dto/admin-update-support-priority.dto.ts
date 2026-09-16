import { IsEnum } from 'class-validator';
import { SupportTicketPriority } from '@prisma/client';

export class AdminUpdateSupportPriorityDto {
  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}
