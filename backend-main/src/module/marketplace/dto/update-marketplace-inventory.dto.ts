import { IsInt, Max, Min } from 'class-validator';
export class UpdateMarketplaceInventoryDto {
  @IsInt() @Min(0) @Max(2147483647) expectedStock!: number;
  @IsInt() @Min(0) @Max(2147483647) stock!: number;
}
