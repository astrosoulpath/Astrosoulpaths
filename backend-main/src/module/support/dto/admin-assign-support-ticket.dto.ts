import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminAssignSupportTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  adminUserId?: string;
}
