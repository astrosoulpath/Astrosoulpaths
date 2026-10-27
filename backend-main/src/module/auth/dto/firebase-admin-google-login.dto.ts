import { IsNotEmpty, IsString } from 'class-validator';

// No client-selected role, portal, email or canonical user ID.
export class FirebaseAdminGoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
