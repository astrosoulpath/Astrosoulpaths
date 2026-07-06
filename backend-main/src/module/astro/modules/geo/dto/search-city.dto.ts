import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SearchCityDto {
  @IsString({
    message: 'City must be a string',
  })
  @IsNotEmpty({
    message: 'City is required',
  })
  @MinLength(1, {
    message: 'City must contain at least 1 character',
  })
  city!: string;
}
