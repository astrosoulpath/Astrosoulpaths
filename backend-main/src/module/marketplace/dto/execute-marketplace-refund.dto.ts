import { IsString, Length } from 'class-validator';
export class ExecuteMarketplaceRefundDto {
  @IsString() @Length(10, 500) reason!: string;
}
