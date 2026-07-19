import { IsEmail, IsString, Length } from 'class-validator';

export class EmailLoginDto {
  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address',
    },
  )
  email: string;

  @IsString()
  @Length(8, 72, {
    message: 'Password must be between 8 and 72 characters',
  })
  password: string;
}