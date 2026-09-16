import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';

type CreateFundAccountInput = {
  astrologerId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
};

type CreatePayoutInput = {
  payoutId: string;
  fundAccountId: string;
  amountPaise: number;
  currency: string;
  mode: 'IMPS' | 'NEFT' | 'RTGS';
  idempotencyKey: string;
};

type RazorpayContactResponse = {
  id: string;
};

type RazorpayFundAccountResponse = {
  id: string;
};

export type RazorpayPayoutResponse = {
  id: string;
  entity?: string;
  fund_account_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  purpose?: string;
  utr?: string | null;
  mode?: string;
  reference_id?: string;
  narration?: string;
  failure_reason?: string | null;
  status_details?: unknown;
  created_at?: number;
};

@Injectable()
export class AstrologerPayoutProviderService {
  private readonly apiBaseUrl = 'https://api.razorpay.com/v1';

  private getAuth() {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!keyId || !keySecret) {
      throw new InternalServerErrorException(
        'Razorpay payout credentials are not configured',
      );
    }

    return {
      username: keyId,
      password: keySecret,
    };
  }

  private getSourceAccountNumber(): string {
    const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER?.trim();

    if (!accountNumber) {
      throw new InternalServerErrorException(
        'RazorpayX payout source account is not configured',
      );
    }

    return accountNumber;
  }

  async createBankFundAccount(input: CreateFundAccountInput) {
    try {
      const contactResponse = await axios.post<RazorpayContactResponse>(
        `${this.apiBaseUrl}/contacts`,
        {
          name: input.name,
          email: input.email || undefined,
          contact: input.phone || undefined,
          type: 'employee',
          reference_id: `astrologer_${input.astrologerId}`,
          notes: {
            astrologerId: input.astrologerId,
            purpose: 'ASTROLOGER_PAYOUT',
          },
        },
        {
          auth: this.getAuth(),
          timeout: 15000,
        },
      );

      const contactId = contactResponse.data.id;

      const fundAccountResponse = await axios.post<RazorpayFundAccountResponse>(
        `${this.apiBaseUrl}/fund_accounts`,
        {
          contact_id: contactId,
          account_type: 'bank_account',
          bank_account: {
            name: input.accountHolderName,
            ifsc: input.ifsc.toUpperCase(),
            account_number: input.accountNumber,
          },
        },
        {
          auth: this.getAuth(),
          timeout: 15000,
        },
      );

      return {
        contactId,
        fundAccountId: fundAccountResponse.data.id,
      };
    } catch (error) {
      this.throwProviderError(error, 'Unable to register payout bank account');
    }
  }

  async createPayout(
    input: CreatePayoutInput,
  ): Promise<RazorpayPayoutResponse> {
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise < 100) {
      throw new BadRequestException('Payout amount must be at least INR 1.00');
    }

    try {
      const response = await axios.post<RazorpayPayoutResponse>(
        `${this.apiBaseUrl}/payouts`,
        {
          account_number: this.getSourceAccountNumber(),
          fund_account_id: input.fundAccountId,
          amount: input.amountPaise,
          currency: input.currency,
          mode: input.mode,
          purpose: 'payout',

          /*
           * Production behavior:
           * Do NOT silently queue money when the RazorpayX
           * business account is underfunded.
           */
          queue_if_low_balance: false,

          reference_id: input.payoutId,

          narration: 'Astro Soul Path',

          notes: {
            internalPayoutId: input.payoutId,
            purpose: 'ASTROLOGER_EARNINGS',
          },
        },
        {
          auth: this.getAuth(),
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'X-Payout-Idempotency': input.idempotencyKey,
          },
        },
      );

      if (!response.data?.id) {
        throw new BadGatewayException('RazorpayX did not return a payout ID');
      }

      return response.data;
    } catch (error) {
      this.throwProviderError(error, 'Unable to create RazorpayX payout');
    }
  }

  private throwProviderError(error: unknown, prefix: string): never {
    if (axios.isAxiosError(error)) {
      const providerMessage =
        typeof error.response?.data === 'object' &&
        error.response?.data !== null
          ? JSON.stringify(error.response.data)
          : error.message;

      throw new BadGatewayException(`${prefix}: ${providerMessage}`);
    }

    throw error;
  }
}
