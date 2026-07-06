import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from '@supabase/supabase-js';

// ✅ Custom type (matches actual Supabase response)
type VerifyOtpResult = {
  user: User | null;
  session: Session | null;
};

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('supabase.url');
    const key = this.config.getOrThrow<string>('supabase.key');

    this.client = createClient(url, key);
  }

  // 📱 Send OTP
  async sendOtp(phone: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      phone,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  // 🔐 Verify OTP
  async verifyOtp(phone: string, token: string): Promise<VerifyOtpResult> {
    const { data, error } = await this.client.auth.verifyOtp({
      phone,
      token,
      type: 'sms', // 🔥 required
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data; // ✅ correct type
  }

  // ⚠️ Optional (use carefully)
  getClient(): SupabaseClient {
    return this.client;
  }
}
