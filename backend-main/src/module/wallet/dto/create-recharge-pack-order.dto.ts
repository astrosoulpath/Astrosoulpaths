import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRechargePackOrderDto {
  @IsString()
  @IsNotEmpty()
  packId!: string;
}
