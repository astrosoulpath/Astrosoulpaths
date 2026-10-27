import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsInt, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
class RefundComponentDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/) sellerOrderId!:string;
  @Equals('INR') currency!:string;
  @IsInt() @Min(0) productMinor!:number;
  @Equals(0) discountMinor!:number;
  @IsInt() @Min(0) shippingMinor!:number;
  @IsInt() @Min(0) taxMinor!:number;
  @Equals(0) feeMinor!:number;
}
export class PrepareMarketplaceRefundDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>RefundComponentDto)
  allocations!:RefundComponentDto[];
}
