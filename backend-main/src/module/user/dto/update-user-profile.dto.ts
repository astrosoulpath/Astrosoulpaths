import { IsOptional, Matches } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserProfileDto } from './create-user-profile.dto';

export class UpdateUserProfileDto extends PartialType(CreateUserProfileDto) {
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, {
    message: 'Residence country must be a two-letter uppercase country code',
  })
  residenceCountryCode?: string;
}
