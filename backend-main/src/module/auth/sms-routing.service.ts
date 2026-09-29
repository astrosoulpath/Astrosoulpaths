import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type SupabaseSmsHookPayload = {
  user?: { phone?: string | null };
  sms?: { otp?: string | null };
};

@Injectable()
export class SmsRoutingService {
  private readonly logger = new Logger(SmsRoutingService.name);

  constructor(private readonly config: ConfigService) {}

  async deliverSupabaseOtp(
    payload: SupabaseSmsHookPayload,
    receivedSecret?: string,
  ): Promise<void> {
    const expectedSecret = this.config.get<string>('SMS_HOOK_SECRET')?.trim();

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid SMS hook request');
    }

    const phone = payload?.user?.phone?.trim();
    const otp = payload?.sms?.otp?.trim();

    if (!phone || !otp || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      throw new HttpException(
        'Invalid Supabase SMS hook payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    const message =
      `Your Astro Soul Path verification code is ${otp}. ` +
      'Do not share this code with anyone.';

    try {
      // India is intentionally isolated to MSG91.
      // Twilio must NOT be used as an India fallback.
      if (phone.startsWith('+91')) {
        await this.sendViaMsg91(phone, otp);

        this.logger.log(
          `OTP delivered via MSG91 route country=IN phone=${this.maskPhone(phone)}`,
        );

        return;
      }

      // Every international number uses Twilio directly.
      // Examples:
      // +1  -> USA / Canada
      // +44 -> United Kingdom
      // +61 -> Australia
      // all other non-+91 E.164 numbers -> Twilio
      await this.sendViaTwilio(phone, message);

      this.logger.log(
        `OTP delivered via Twilio international route phone=${this.maskPhone(phone)}`,
      );
    } catch (providerError: unknown) {
      const reason =
        providerError instanceof Error
          ? providerError.message
          : 'Unknown provider error';

      const provider = phone.startsWith('+91') ? 'MSG91' : 'Twilio';

      this.logger.error(
        `${provider} OTP delivery failed for ${this.maskPhone(phone)}: ${reason}`,
      );

      throw new HttpException(
        'Unable to send OTP. Please try again shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
  private async sendViaMsg91(phone: string, otp: string): Promise<void> {
    const authKey = this.requireEnv('MSG91_AUTH_KEY');
    const flowId = this.requireEnv('MSG91_FLOW_ID');
    const sender = this.requireEnv('MSG91_SENDER_ID');

    await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      {
        flow_id: flowId,
        sender,
        mobiles: phone.replace('+', ''),
        otp,
      },
      {
        headers: {
          authkey: authKey,
          'content-type': 'application/json',
        },
        timeout: 10000,
      },
    );
  }

  private async sendViaTwilio(phone: string, message: string): Promise<void> {
    const accountSid = this.requireEnv('TWILIO_ACCOUNT_SID');
    const authToken = this.requireEnv('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_SMS_FROM')?.trim();
    const messagingServiceSid = this.config
      .get<string>('TWILIO_MESSAGING_SERVICE_SID')
      ?.trim();

    if (!from && !messagingServiceSid) {
      throw new Error(
        'Set TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID for international SMS',
      );
    }

    const form = new URLSearchParams({
      To: phone,
      Body: message,
    });

    if (messagingServiceSid) {
      form.set('MessagingServiceSid', messagingServiceSid);
    } else if (from) {
      form.set('From', from);
    }

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      form.toString(),
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      },
    );
  }

  private requireEnv(name: string): string {
    const value = this.config.get<string>(name)?.trim();

    if (!value) {
      throw new Error(`${name} is not configured`);
    }

    return value;
  }

  private maskPhone(phone: string): string {
    return phone.length > 5
      ? `${phone.slice(0, 3)}***${phone.slice(-2)}`
      : '***';
  }
}
