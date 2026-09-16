import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

export class ExtendCallDto {
  @Type(() => Number)
  @IsInt({
    message: 'Extension minutes must be a whole number',
  })
  @IsIn([5, 10], {
    message: 'Call can only be extended by 5 or 10 minutes',
  })
  minutes!: number;
}
