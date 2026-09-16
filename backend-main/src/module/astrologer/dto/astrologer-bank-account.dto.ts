import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpsertAstrologerBankAccountDto {
  @IsString()
  @Length(2, 120)
  accountHolderName!: string;

  @IsString()
  @Matches(/^[0-9]{6,20}$/, {
    message: 'Account number must contain 6 to 20 digits',
  })
  accountNumber!: string;

  @IsString()
  @Matches(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, {
    message: 'Invalid IFSC code',
  })
  ifsc!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  bankName?: string;
}

export class AstrologerWithdrawalDto {
  @IsOptional()
  @IsIn(['IMPS', 'NEFT', 'RTGS'])
  mode?: 'IMPS' | 'NEFT' | 'RTGS';
}
