import { Transform } from 'class-transformer';
import { IsNotEmpty, Matches } from 'class-validator';

export class SendOtpDto {
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedPhone = value.trim();

    // Spaces, hyphens, brackets and other formatting remove karega.
    if (trimmedPhone.startsWith('+')) {
      return `+${trimmedPhone.slice(1).replace(/\D/g, '')}`;
    }

    return trimmedPhone.replace(/\D/g, '');
  })
  @IsNotEmpty({
    message: 'phone is required',
  })
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'phone must include country code in international format, for example +919999999999',
  })
  phone!: string;
}