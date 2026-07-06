import { IsString } from 'class-validator';

export class CreateMatchDto {
  @IsString()
  profile1Id: string;

  @IsString()
  profile2Id: string;
}
