import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';

type AuthResult = {
  user: User | null;
  session: Session | null;
};

type EmailSignupInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly adminClient: SupabaseClient | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('supabase.url');
    const publicKey = this.config.getOrThrow<string>('supabase.key');

    this.client = createClient(url, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const serviceRoleKey = this.config.get<string>(
      'supabase.serviceRoleKey',
    );

    this.adminClient = serviceRoleKey
      ? createClient(url, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null;
  }

  async sendOtp(phone: string): Promise<void> {
    const normalizedPhone = phone?.trim();

    if (!normalizedPhone) {
      throw new BadRequestException('Phone number is required');
    }

    const { error } = await this.client.auth.signInWithOtp({
      phone: normalizedPhone,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  async verifyOtp(phone: string, token: string): Promise<AuthResult> {
    const normalizedPhone = phone?.trim();
    const normalizedToken = token?.trim();

    if (!normalizedPhone) {
      throw new BadRequestException('Phone number is required');
    }

    if (!normalizedToken) {
      throw new BadRequestException('OTP is required');
    }

    const { data, error } = await this.client.auth.verifyOtp({
      phone: normalizedPhone,
      token: normalizedToken,
      type: 'sms',
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  /**
   * Creates a real Supabase Auth user using email and password.
   *
   * The password is handled by Supabase Auth and is never stored
   * in the application's Prisma database.
   */
  async signUpWithEmail(input: EmailSignupInput): Promise<AuthResult> {
    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    const password = input.password;

    if (!fullName) {
      throw new BadRequestException('Full name is required');
    }

    if (!email) {
      throw new BadRequestException('Email address is required');
    }

    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone_number: phone,
          auth_provider: 'email',
        },
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new BadRequestException('Unable to create user account');
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  /**
   * Authenticates an existing Supabase user using email/password.
   */
  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<AuthResult> {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Email address is required');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }

    const { data, error } =
      await this.client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user || !data.session) {
      throw new BadRequestException(
        'Unable to create authentication session',
      );
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  /**
   * Public Supabase authentication client.
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Server-side client for storage and privileged backend operations.
   */
  getStorageClient(): SupabaseClient {
    return this.adminClient ?? this.client;
  }

  hasAdminClient(): boolean {
    return this.adminClient !== null;
  }
}