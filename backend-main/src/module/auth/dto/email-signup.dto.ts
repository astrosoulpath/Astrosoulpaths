import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EmailSignupDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, {
    message: 'Full name must contain at least 2 characters',
  })
  @MaxLength(100, {
    message: 'Full name cannot exceed 100 characters',
  })
  @Matches(/^[a-zA-ZÀ-ÿ\u0900-\u097F\s.'-]+$/, {
    message: 'Full name contains invalid characters',
  })
  fullName: string;

  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address',
    },
  )
  @MaxLength(254, {
    message: 'Email address is too long',
  })
  email: string;

  @IsString()
  @Matches(/^\+[1-9]\d{9,14}$/, {
    message:
      'Phone number must be in international format, for example +919876543210',
  })
  phone: string;

  @IsString()
  @Length(8, 72, {
    message: 'Password must be between 8 and 72 characters',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number',
  })
  @Matches(/[^a-zA-Z0-9]/, {
    message: 'Password must contain at least one special character',
  })
  password: string;
}