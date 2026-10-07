import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class FirebaseEmailLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsIn(['customer'])
  portal: 'customer' = 'customer';
}
