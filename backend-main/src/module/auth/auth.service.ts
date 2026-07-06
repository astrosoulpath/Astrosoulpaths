import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { UserService } from '../user/user.service';

type AuthUserRecord = Prisma.UserGetPayload<{
  include: {
    role: true;
    subscriptionPlan: true;
    astrologer: true;
  };
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly userService: UserService,
  ) {}

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private buildSessionPayload(session: Session) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt:
        session.expires_at ||
        Math.floor(Date.now() / 1000) + session.expires_in,
      tokenType: session.token_type,
    };
  }

  private buildUserPayload(user: AuthUserRecord, isNewUser: boolean) {
    return {
      id: user.id,
      supabaseId: user.supabaseId,
      phone: user.phone,
      role: user.role?.name || 'user',
      isNewUser,
      isProfileComplete: user.isProfileComplete,
      subscriptionPlan: user.subscriptionPlan?.name || 'FREE',
      subscriptionStatus: user.subscriptionStatus || 'FREE',
    };
  }

  private getUserNextStep(user: AuthUserRecord) {
    return user.isProfileComplete ? 'OPEN_HOME' : 'COMPLETE_PROFILE';
  }

  private buildAstrologerPayload(user: AuthUserRecord) {
    const hasAstrologerProfile = Boolean(user.astrologer);
    const canAccessAstrologerApp = Boolean(user.isAstrologer);
    const isExistingAstrologer = canAccessAstrologerApp && hasAstrologerProfile;
    const isNewAstrologer = canAccessAstrologerApp && !hasAstrologerProfile;

    return {
      canAccessAstrologerApp,
      isAstrologer: Boolean(user.isAstrologer),
      isNewAstrologer,
      isExistingAstrologer,
      hasAstrologerProfile,
      astrologerId: user.astrologer?.id || null,
      isApproved: user.astrologer?.isApproved ?? false,
      isVerified: user.astrologer?.isVerified ?? false,
      onboardingStatus: !canAccessAstrologerApp
        ? 'NOT_ASTROLOGER'
        : isNewAstrologer
          ? 'NEW_ASTROLOGER'
          : 'EXISTING_ASTROLOGER',
    };
  }

  // 📩 Send OTP
  async sendOtp(phone: string) {
    try {
      // Basic validation
      if (!phone || phone.length < 10) {
        throw new BadRequestException({
          success: false,
          message: 'Invalid phone number',
          code: 'INVALID_PHONE',
        });
      }

      const supabase = this.supabaseService.getClient();

      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        this.logger.warn(`OTP send failed for ${phone}: ${error.message}`);

        // Supabase rate limit
        if (
          error.message.toLowerCase().includes('rate limit') ||
          error.message.toLowerCase().includes('too many')
        ) {
          throw new BadRequestException({
            success: false,
            message: 'Too many OTP requests. Please try again later.',
            code: 'OTP_RATE_LIMIT',
          });
        }

        throw new BadRequestException({
          success: false,
          message: error.message || 'Failed to send OTP',
          code: 'OTP_SEND_FAILED',
        });
      }

      return {
        success: true,
        message: 'OTP sent successfully',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (err instanceof BadRequestException) {
        this.logger.warn(`Send OTP handled failure for ${phone}: ${message}`);
        throw err;
      }

      this.logger.error(`Send OTP failed for ${phone}: ${message}`);

      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to send OTP. Please try again later.',
        code: 'OTP_INTERNAL_ERROR',
      });
    }
  }

  async sendAstrologerOtp(phone: string) {
    const response = await this.sendOtp(phone);

    return {
      ...response,
      portal: 'astrologer',
    };
  }

  // 🔐 Verify OTP
  async verifyOtp(phone: string, token: string) {
    try {
      // Basic validation
      if (!phone || !token) {
        throw new BadRequestException({
          success: false,
          message: 'Phone and OTP are required',
          code: 'MISSING_CREDENTIALS',
        });
      }

      let data: Awaited<ReturnType<SupabaseService['verifyOtp']>>;

      try {
        // Step 1: Verify OTP via Supabase
        data = await this.supabaseService.verifyOtp(phone, token);
      } catch (supabaseError: unknown) {
        const errorMessage = this.getErrorMessage(supabaseError).toLowerCase();

        // Invalid OTP
        if (
          errorMessage.includes('invalid') ||
          errorMessage.includes('otp') ||
          errorMessage.includes('token')
        ) {
          throw new UnauthorizedException({
            success: false,
            message: 'Invalid OTP',
            code: 'INVALID_OTP',
          });
        }

        // Expired OTP
        if (errorMessage.includes('expired')) {
          throw new UnauthorizedException({
            success: false,
            message: 'OTP expired',
            code: 'OTP_EXPIRED',
          });
        }

        // Too many attempts
        if (
          errorMessage.includes('too many') ||
          errorMessage.includes('rate limit')
        ) {
          throw new BadRequestException({
            success: false,
            message: 'Too many verification attempts. Please try again later.',
            code: 'OTP_RATE_LIMIT',
          });
        }

        // User/phone missing
        if (
          errorMessage.includes('not found') ||
          errorMessage.includes('user not found')
        ) {
          throw new NotFoundException({
            success: false,
            message: 'Phone number not found',
            code: 'PHONE_NOT_FOUND',
          });
        }

        // Fallback auth failure
        throw new UnauthorizedException({
          success: false,
          message:
            this.getErrorMessage(supabaseError) || 'Authentication failed',
          code: 'AUTH_FAILED',
        });
      }

      const authUser = data.user;
      const session = data.session;

      // Safety validation
      if (!authUser || !session) {
        throw new UnauthorizedException({
          success: false,
          message: 'Authentication failed',
          code: 'AUTH_FAILED',
        });
      }

      // Step 2: Sync/Create user
      const { user, isNewUser } = await this.userService.syncUser({
        supabaseId: authUser.id,
        phone: authUser.phone,
      });

      // Step 3: Success response
      return {
        success: true,
        message: 'Login successful',

        user: this.buildUserPayload(user, isNewUser),
        session: this.buildSessionPayload(session),
        nextStep: this.getUserNextStep(user),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Expected handled auth failures
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof NotFoundException
      ) {
        this.logger.warn(`Verify OTP handled failure for ${phone}: ${message}`);
        throw err;
      }

      // Unexpected system failures
      this.logger.error(`Verify OTP failed for ${phone}: ${message}`);

      throw new InternalServerErrorException({
        success: false,
        message: 'Authentication failed. Please try again later.',
        code: 'AUTH_INTERNAL_ERROR',
      });
    }
  }

  async verifyAstrologerOtp(phone: string, token: string) {
    const loginResponse = await this.verifyOtp(phone, token);
    const user = await this.userService.ensureAstrologerProfileBySupabaseId(
      loginResponse.user.supabaseId,
    );

    const astrologer = this.buildAstrologerPayload(user);
    const session = loginResponse.session;

    return {
      success: true,
      message: astrologer.canAccessAstrologerApp
        ? 'Astrologer login successful'
        : 'Authenticated, but astrologer access is not enabled for this account',
      portal: 'astrologer',
      role: 'ASTROLOGER',
      astrologerId: astrologer.astrologerId,
      accessToken: session.accessToken,
      astrologer,
      nextStep: astrologer.canAccessAstrologerApp
        ? astrologer.isNewAstrologer
          ? 'COMPLETE_ASTROLOGER_ONBOARDING'
          : 'OPEN_ASTROLOGER_DASHBOARD'
        : 'CONTACT_ADMIN_OR_ENABLE_IS_ASTROLOGER',
    };
  }
}
