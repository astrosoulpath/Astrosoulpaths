import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';

type VerifyOtpResult = {
  user: User | null;
  session: Session | null;
};

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly adminClient: SupabaseClient | null;

  constructor(
    private readonly config: ConfigService,
  ) {
    const url =
      this.config.getOrThrow<string>(
        'supabase.url',
      );

    const publicKey =
      this.config.getOrThrow<string>(
        'supabase.key',
      );

    this.client = createClient(
      url,
      publicKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const serviceRoleKey =
      this.config.get<string>(
        'supabase.serviceRoleKey',
      );

    this.adminClient = serviceRoleKey
      ? createClient(
          url,
          serviceRoleKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        )
      : null;
  }

  async sendOtp(
    phone: string,
  ): Promise<void> {
    const normalizedPhone =
      phone?.trim();

    if (!normalizedPhone) {
      throw new BadRequestException(
        'Phone number is required',
      );
    }

    const { error } =
      await this.client.auth.signInWithOtp({
        phone: normalizedPhone,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }
  }

  async verifyOtp(
    phone: string,
    token: string,
  ): Promise<VerifyOtpResult> {
    const normalizedPhone =
      phone?.trim();

    const normalizedToken =
      token?.trim();

    if (!normalizedPhone) {
      throw new BadRequestException(
        'Phone number is required',
      );
    }

    if (!normalizedToken) {
      throw new BadRequestException(
        'OTP is required',
      );
    }

    const { data, error } =
      await this.client.auth.verifyOtp({
        phone: normalizedPhone,
        token: normalizedToken,
        type: 'sms',
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return data;
  }

  /**
   * Public/Auth client.
   *
   * Existing authentication flows can continue using this.
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Server-side client for Storage and privileged backend work.
   *
   * During local development, this falls back to the configured
   * public client when a service-role key is not yet available.
   * Production should always configure SUPABASE_SERVICE_ROLE_KEY.
   */
  getStorageClient(): SupabaseClient {
    return this.adminClient ?? this.client;
  }

  hasAdminClient(): boolean {
    return this.adminClient !== null;
  }
}