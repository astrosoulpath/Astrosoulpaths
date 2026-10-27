import { IsString, Matches, MaxLength } from 'class-validator';
export class ReconcileMarketplaceRefundDto {
  @IsString() @Matches(/^rfnd_[a-zA-Z0-9]+$/) @MaxLength(100)
  refundId!:string;
  @IsString() @Matches(/^[a-f0-9-]{36}$/i)
  fence!:string;
}
