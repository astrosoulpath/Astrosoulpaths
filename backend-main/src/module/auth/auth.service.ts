import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * Local OTP is strictly development-only.
   * Even if LOCAL_OTP_ENABLED=true is accidentally configured in production,
   * local OTP and local token generation remain disabled.
   */
  private isLocalOtpEnabled(): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.LOCAL_OTP_ENABLED === 'true'
    );
  }

  private buildSessionPayload(session: Session) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt:
        session.expires_at ??
        Math.floor(Date.now() / 1000) + session.expires_in,
      tokenType: session.token_type,
    };
  }

  /**
   * Builds the database/account-level user payload.
   * The role returned here is the permanent account role stored in the DB.
   * Portal-specific role overrides are added by customer, astrologer and admin
   * login methods before sending the final response to the frontend.
   */
  private buildUserPayload(user: AuthUserRecord, isNewUser: boolean) {
    return {
      id: user.id,
      supabaseId: user.supabaseId,
      phone: user.phone,
      role: user.role?.name ?? 'USER',
      isNewUser,
      isProfileComplete: user.isProfileComplete,
      subscriptionPlan: user.subscriptionPlan?.name ?? 'FREE',
      subscriptionStatus: user.subscriptionStatus ?? 'FREE',
    };
  }

  private buildCustomerUserPayload(user: AuthUserRecord, isNewUser: boolean) {
    const accountUser = this.buildUserPayload(user, isNewUser);

    const freeChatEligible =
      user.freeChatGrantedAt !== null && user.freeChatUsedAt === null;

    return {
      ...accountUser,

      // Canonical ASP identity fields.
      // Auth-provider sessions may contain only phone OR email,
      // but the application account can safely contain both.
      phone: user.phone ?? null,
      email: user.email ?? null,

      role: 'CUSTOMER',
      portal: 'customer',
      accountRole: accountUser.role,
      isAstrologer: Boolean(user.isAstrologer),
      freeChat: {
        eligible: freeChatEligible,
        used: user.freeChatUsedAt !== null,
        minutes: user.freeChatMinutes,
        showPopup: freeChatEligible,
      },
    };
  }
  private getCustomerNextStep(user: AuthUserRecord) {
    return user.isProfileComplete ? 'OPEN_HOME' : 'COMPLETE_PROFILE';
  }

  private buildAstrologerPayload(user: AuthUserRecord) {
    const hasAstrologerProfile = Boolean(user.astrologer);
    const canAccessAstrologerApp = Boolean(user.isAstrologer);

    const isApprovedAstrologer =
      canAccessAstrologerApp &&
      hasAstrologerProfile &&
      Boolean(user.astrologer?.isApproved) &&
      Boolean(user.astrologer?.isVerified);

    const isPendingApproval =
      canAccessAstrologerApp && hasAstrologerProfile && !isApprovedAstrologer;

    const needsRegistration = canAccessAstrologerApp && !hasAstrologerProfile;

    return {
      canAccessAstrologerApp,
      isAstrologer: Boolean(user.isAstrologer),
      hasAstrologerProfile,
      astrologerId: user.astrologer?.id ?? null,
      isApproved: user.astrologer?.isApproved ?? false,
      isVerified: user.astrologer?.isVerified ?? false,
      onboardingStatus: needsRegistration
        ? 'NEW_ASTROLOGER'
        : isPendingApproval
          ? 'PENDING_APPROVAL'
          : isApprovedAstrologer
            ? 'APPROVED_ASTROLOGER'
            : 'NOT_ASTROLOGER',
    };
  }

  async sendOtp(phone: string) {
    try {
      const normalizedPhone = phone?.trim();

      if (!normalizedPhone || normalizedPhone.length < 10) {
        throw new BadRequestException({
          success: false,
          message: 'Invalid phone number',
          code: 'INVALID_PHONE',
        });
      }

      if (this.isLocalOtpEnabled()) {
        return {
          success: true,
          message: 'Local dev OTP sent successfully',
          devOtp: process.env.LOCAL_OTP_CODE || '123456',
          portal: 'customer',
        };
      }

      try {
        await this.supabaseService.sendOtp(normalizedPhone);
      } catch (error) {
        const errorMessage = this.getErrorMessage(error);

        this.logger.warn(`OTP send failed: ${errorMessage}`);

        const normalizedError = errorMessage.toLowerCase();

        if (
          normalizedError.includes('rate limit') ||
          normalizedError.includes('too many')
        ) {
          throw new HttpException(
            {
              success: false,
              message: 'Too many OTP requests. Please try again later.',
              code: 'OTP_RATE_LIMIT',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        throw new BadRequestException({
          success: false,
          message: 'Unable to send OTP. Please try again.',
          code: 'OTP_SEND_FAILED',
        });
      }

      return {
        success: true,
        message: 'OTP sent successfully',
        portal: 'customer',
      };
    } catch (err) {
      const message = this.getErrorMessage(err);

      if (err instanceof HttpException) {
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
    const normalizedPhone = phone?.trim();

    if (!normalizedPhone) {
      throw new BadRequestException({
        success: false,
        message: 'Phone number is required',
        code: 'PHONE_REQUIRED',
      });
    }

    const fullUser =
      await this.userService.getUserWithRelationsByPhone(normalizedPhone);

    if (!fullUser || !fullUser.isAstrologer) {
      throw new UnauthorizedException({
        success: false,
        message: 'Astrologer access is not enabled for this account',
        code: 'ASTROLOGER_ACCESS_DENIED',
      });
    }

    const astrologer = this.buildAstrologerPayload(fullUser);

    if (
      !astrologer.hasAstrologerProfile ||
      !astrologer.isApproved ||
      !astrologer.isVerified
    ) {
      throw new UnauthorizedException({
        success: false,
        message: 'Astrologer account is pending admin approval',
        code: 'ASTROLOGER_APPROVAL_PENDING',
      });
    }

    const response = await this.sendOtp(normalizedPhone);

    return {
      ...response,
      portal: 'astrologer',
    };
  }

  async sendJoinAstrologerOtp(phone: string) {
    const response = await this.sendOtp(phone);

    return {
      ...response,
      portal: 'joinAstrologer',
    };
  }
  async sendAdminOtp(phone: string) {
    const response = await this.sendOtp(phone);

    return {
      ...response,
      portal: 'admin',
    };
  }

  /**
   * Customer OTP verification.
   * An account may also have astrologer capability, but customer login always
   * returns portal=customer and role=CUSTOMER for frontend navigation.
   */
  async verifyOtp(phone: string, token: string) {
    try {
      const normalizedPhone = phone?.trim();
      const normalizedToken = token?.trim();

      if (!normalizedPhone || !normalizedToken) {
        throw new BadRequestException({
          success: false,
          message: 'Phone and OTP are required',
          code: 'MISSING_CREDENTIALS',
        });
      }

      if (this.isLocalOtpEnabled()) {
        if (normalizedToken !== (process.env.LOCAL_OTP_CODE || '123456')) {
          throw new UnauthorizedException({
            success: false,
            message: 'Invalid OTP',
            code: 'INVALID_OTP',
          });
        }

        const localSupabaseId = `local-supabase-${normalizedPhone.replace(/\D/g, '')}`;

        const { user, isNewUser } = await this.userService.syncUser({
          supabaseId: localSupabaseId,
          phone: normalizedPhone,
          email: null,
          fullName: null,
        });
        // Customer portal access is identity-based.
        // Permanent account role (admin/user) remains unchanged.

        return {
          success: true,
          message: 'Local dev login successful',
          portal: 'customer',
          role: 'CUSTOMER',
          accessToken: `local-dev-token:${localSupabaseId}`,
          user: this.buildCustomerUserPayload(user, isNewUser),
          session: {
            accessToken: `local-dev-token:${localSupabaseId}`,
            refreshToken: `local-refresh-token:${localSupabaseId}`,
            expiresIn: 3600,
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            tokenType: 'bearer',
          },
          nextStep: this.getCustomerNextStep(user),
        };
      }

      let data: Awaited<ReturnType<SupabaseService['verifyOtp']>>;

      try {
        data = await this.supabaseService.verifyOtp(
          normalizedPhone,
          normalizedToken,
        );
      } catch (supabaseError: unknown) {
        const errorMessage = this.getErrorMessage(supabaseError).toLowerCase();

        if (errorMessage.includes('expired')) {
          throw new UnauthorizedException({
            success: false,
            message: 'OTP expired',
            code: 'OTP_EXPIRED',
          });
        }

        if (
          errorMessage.includes('too many') ||
          errorMessage.includes('rate limit')
        ) {
          throw new HttpException(
            {
              success: false,
              message:
                'Too many verification attempts. Please try again later.',
              code: 'OTP_RATE_LIMIT',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

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

        throw new UnauthorizedException({
          success: false,
          message:
            this.getErrorMessage(supabaseError) || 'Authentication failed',
          code: 'AUTH_FAILED',
        });
      }

      const authUser = data.user;
      const session = data.session;

      if (!authUser || !session) {
        throw new UnauthorizedException({
          success: false,
          message: 'Authentication failed',
          code: 'AUTH_FAILED',
        });
      }
      const { user, isNewUser } = await this.userService.syncUser({
        supabaseId: authUser.id,
        phone: authUser.phone,
        email: authUser.email ?? null,
        fullName:
          authUser.user_metadata?.full_name ??
          authUser.user_metadata?.name ??
          null,
      });
        // Customer portal access is identity-based.
        // Permanent account role (admin/user) remains unchanged.

      const sessionPayload = this.buildSessionPayload(session);

      return {
        success: true,
        message: 'Login successful',
        portal: 'customer',
        role: 'CUSTOMER',
        accessToken: sessionPayload.accessToken,
        user: this.buildCustomerUserPayload(user, isNewUser),
        session: sessionPayload,
        nextStep: this.getCustomerNextStep(user),
      };
    } catch (err) {
      const message = this.getErrorMessage(err);

      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof NotFoundException
      ) {
        this.logger.warn(`Verify OTP handled failure for ${phone}: ${message}`);
        throw err;
      }

      this.logger.error(
        `Verify OTP failed for ${phone}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );

      throw new InternalServerErrorException({
        success: false,
        message: 'Authentication failed. Please try again later.',
        code: 'AUTH_INTERNAL_ERROR',
      });
    }
  }

  async verifyAstrologerOtp(phone: string, token: string) {
    const loginResponse = await this.verifyOtp(phone, token);

    const fullUser = await this.userService.getUserWithRelations(
      loginResponse.user.supabaseId,
    );

    if (!fullUser) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!fullUser.isAstrologer) {
      throw new UnauthorizedException({
        success: false,
        message: 'Astrologer access is not enabled for this account',
        code: 'ASTROLOGER_ACCESS_DENIED',
      });
    }

    const astrologer = this.buildAstrologerPayload(fullUser);

    if (
      !astrologer.hasAstrologerProfile ||
      !astrologer.isApproved ||
      !astrologer.isVerified
    ) {
      throw new UnauthorizedException({
        success: false,
        message: 'Astrologer account is pending admin approval',
        code: 'ASTROLOGER_APPROVAL_PENDING',
      });
    }

    const nextStep = 'OPEN_ASTROLOGER_DASHBOARD';

    return {
      success: true,
      message: 'Astrologer login successful',
      portal: 'astrologer',
      role: 'ASTROLOGER',
      accessToken: loginResponse.session.accessToken,
      user: {
        ...loginResponse.user,
        role: 'ASTROLOGER',
        portal: 'astrologer',
        accountRole: fullUser.role?.name ?? 'ASTROLOGER',
        isAstrologer: true,
      },
      session: loginResponse.session,
      astrologer,
      nextStep,
    };
  }

  async verifyJoinAstrologerOtp(phone: string, token: string) {
    const loginResponse = await this.verifyOtp(phone, token);

    const fullUser = await this.userService.getUserWithRelations(
      loginResponse.user.supabaseId,
    );

    if (!fullUser) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const hasAstrologerProfile = Boolean(fullUser.astrologer);

    const isApprovedAstrologer =
      hasAstrologerProfile &&
      Boolean(fullUser.astrologer?.isApproved) &&
      Boolean(fullUser.astrologer?.isVerified);

    const nextStep = !hasAstrologerProfile
      ? 'COMPLETE_ASTROLOGER_ONBOARDING'
      : isApprovedAstrologer
        ? 'OPEN_ASTROLOGER_DASHBOARD'
        : 'WAIT_FOR_ADMIN_APPROVAL';

    return {
      success: true,
      message: hasAstrologerProfile
        ? 'Astrologer application found'
        : 'Mobile number verified. Complete your astrologer application.',
      portal: 'joinAstrologer',
      role: 'ASTROLOGER_APPLICANT',
      accessToken: loginResponse.session.accessToken,
      user: {
        ...loginResponse.user,
        portal: 'joinAstrologer',
        accountRole: fullUser.role?.name ?? 'USER',
        isAstrologer: Boolean(fullUser.isAstrologer),
      },
      session: loginResponse.session,
      astrologer: {
        hasAstrologerProfile,
        astrologerId: fullUser.astrologer?.id ?? null,
        isApproved: fullUser.astrologer?.isApproved ?? false,
        isVerified: fullUser.astrologer?.isVerified ?? false,
      },
      nextStep,
    };
  }
  async verifyAdminOtp(phone: string, token: string) {
    const loginResponse = await this.verifyOtp(phone, token);

    const fullUser = await this.userService.getUserWithRelations(
      loginResponse.user.supabaseId,
    );

    if (!fullUser) {
      throw new NotFoundException({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (fullUser.role?.name?.toUpperCase() !== 'ADMIN') {
      throw new UnauthorizedException({
        success: false,
        message: 'Admin access denied',
        code: 'ADMIN_ACCESS_DENIED',
      });
    }

    return {
      success: true,
      message: 'Admin login successful',
      portal: 'admin',
      role: 'ADMIN',
      accessToken: loginResponse.session.accessToken,
      user: {
        ...loginResponse.user,
        role: 'ADMIN',
        portal: 'admin',
        accountRole: 'ADMIN',
        isAstrologer: Boolean(fullUser.isAstrologer),
      },
      session: loginResponse.session,
      nextStep: 'OPEN_ADMIN_DASHBOARD',
    };
  }

  /**
   * Refreshes an expired Supabase access token using the rotating
   * refresh token returned at login.
   *
   * Access-token expiry is normal and must not force a user to
   * authenticate again while the refresh session is still valid.
   */
  async refreshSession(
    refreshToken: string,
    portal: 'customer' | 'astrologer' | 'joinAstrologer' | 'admin' = 'customer',
  ) {
    const normalizedRefreshToken = refreshToken?.trim();

    if (!normalizedRefreshToken) {
      throw new BadRequestException({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_REQUIRED',
      });
    }

    if (
      !['customer', 'astrologer', 'joinAstrologer', 'admin'].includes(portal)
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid authentication portal',
        code: 'INVALID_AUTH_PORTAL',
      });
    }

    try {
      // Development sessions intentionally never call Supabase.
      if (this.isLocalOtpEnabled()) {
        const prefix = 'local-refresh-token:';

        if (!normalizedRefreshToken.startsWith(prefix)) {
          throw new UnauthorizedException({
            success: false,
            message: 'Invalid refresh session',
            code: 'SESSION_REFRESH_FAILED',
          });
        }

        const localSupabaseId = normalizedRefreshToken.slice(prefix.length);

        if (!localSupabaseId) {
          throw new UnauthorizedException({
            success: false,
            message: 'Invalid refresh session',
            code: 'SESSION_REFRESH_FAILED',
          });
        }

        const fullUser =
          await this.userService.getUserWithRelations(localSupabaseId);

        if (!fullUser || !fullUser.isActive || fullUser.isBlocked) {
          throw new UnauthorizedException({
            success: false,
            message: 'Authentication session is no longer valid',
            code: 'SESSION_REVOKED',
          });
        }

        if (
          portal === 'astrologer' &&
          (!fullUser.isAstrologer ||
            !fullUser.astrologer ||
            !fullUser.astrologer.isApproved ||
            !fullUser.astrologer.isVerified)
        ) {
          throw new UnauthorizedException({
            success: false,
            message: 'Astrologer access is no longer available',
            code: 'ASTROLOGER_ACCESS_DENIED',
          });
        }

        if (
          portal === 'admin' &&
          fullUser.role?.name?.toUpperCase() !== 'ADMIN'
        ) {
          throw new UnauthorizedException({
            success: false,
            message: 'Admin access denied',
            code: 'ADMIN_ACCESS_DENIED',
          });
        }

        const accessToken = `local-dev-token:${localSupabaseId}`;

        return {
          success: true,
          message: 'Session refreshed',
          portal,
          accessToken,
          session: {
            accessToken,
            refreshToken: normalizedRefreshToken,
            expiresIn: 3600,
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            tokenType: 'bearer',
          },
        };
      }

      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: normalizedRefreshToken,
      });

      if (error || !data.session || !data.user) {
        this.logger.warn(
          `Session refresh rejected: ${error?.message ?? 'missing session'}`,
        );

        throw new UnauthorizedException({
          success: false,
          message: 'Your authentication session is no longer valid',
          code: 'SESSION_REFRESH_FAILED',
        });
      }

      // Re-check the application account on every refresh so revoked,
      // blocked or downgraded accounts cannot continue using old sessions.
      const fullUser = await this.userService.getUserWithRelations(
        data.user.id,
      );

      if (!fullUser || !fullUser.isActive || fullUser.isBlocked) {
        throw new UnauthorizedException({
          success: false,
          message: 'Your authentication session is no longer valid',
          code: 'SESSION_REVOKED',
        });
      }

      if (
        portal === 'astrologer' &&
        (!fullUser.isAstrologer ||
          !fullUser.astrologer ||
          !fullUser.astrologer.isApproved ||
          !fullUser.astrologer.isVerified)
      ) {
        throw new UnauthorizedException({
          success: false,
          message: 'Astrologer access is no longer available',
          code: 'ASTROLOGER_ACCESS_DENIED',
        });
      }

      if (
        portal === 'admin' &&
        fullUser.role?.name?.toUpperCase() !== 'ADMIN'
      ) {
        throw new UnauthorizedException({
          success: false,
          message: 'Admin access denied',
          code: 'ADMIN_ACCESS_DENIED',
        });
      }

      const sessionPayload = this.buildSessionPayload(data.session);

      return {
        success: true,
        message: 'Session refreshed',
        portal,
        accessToken: sessionPayload.accessToken,
        session: sessionPayload,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = this.getErrorMessage(error);

      this.logger.warn(`Session refresh failed: ${message}`);

      throw new UnauthorizedException({
        success: false,
        message: 'Your authentication session is no longer valid',
        code: 'SESSION_REFRESH_FAILED',
      });
    }
  }

  async sendEmailOtp(email: string) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException({
        success: false,
        message: 'Email is required',
        code: 'EMAIL_REQUIRED',
      });
    }

    try {
      await this.supabaseService.sendEmailOtp(normalizedEmail);

      return {
        success: true,
        message: 'OTP sent successfully',
        portal: 'customer',
        destination: 'email',
      };
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      const normalizedError = errorMessage.toLowerCase();

      this.logger.warn(`Email OTP send failed: ${errorMessage}`);

      if (
        normalizedError.includes('rate limit') ||
        normalizedError.includes('too many')
      ) {
        throw new HttpException(
          {
            success: false,
            message: 'Too many OTP requests. Please try again later.',
            code: 'OTP_RATE_LIMIT',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException({
        success: false,
        message: 'Unable to send OTP. Please try again.',
        code: 'EMAIL_OTP_SEND_FAILED',
      });
    }
  }

  async verifyEmailOtp(email: string, token: string) {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedToken = token?.trim();

    if (!normalizedEmail || !normalizedToken) {
      throw new BadRequestException({
        success: false,
        message: 'Email and OTP are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    let authResult: Awaited<ReturnType<SupabaseService['verifyEmailOtp']>>;

    try {
      authResult = await this.supabaseService.verifyEmailOtp(
        normalizedEmail,
        normalizedToken,
      );
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error).toLowerCase();

      if (errorMessage.includes('expired')) {
        throw new UnauthorizedException({
          success: false,
          message: 'OTP expired',
          code: 'OTP_EXPIRED',
        });
      }

      if (errorMessage.includes('invalid') || errorMessage.includes('token')) {
        throw new UnauthorizedException({
          success: false,
          message: 'Invalid OTP',
          code: 'INVALID_OTP',
        });
      }

      if (
        errorMessage.includes('too many') ||
        errorMessage.includes('rate limit')
      ) {
        throw new HttpException(
          {
            success: false,
            message: 'Too many attempts. Please try again later.',
            code: 'OTP_RATE_LIMIT',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException({
        success: false,
        message: 'Unable to verify OTP',
        code: 'EMAIL_OTP_VERIFY_FAILED',
      });
    }

    const authUser = authResult.user;
    const session = authResult.session;

    if (!authUser || !session) {
      throw new UnauthorizedException({
        success: false,
        message: 'Authentication session could not be created',
        code: 'SESSION_MISSING',
      });
    }

    const verifiedEmail = authUser.email?.trim().toLowerCase() ?? '';

    if (!verifiedEmail || verifiedEmail !== normalizedEmail) {
      throw new UnauthorizedException({
        success: false,
        message: 'Verified email does not match',
        code: 'EMAIL_MISMATCH',
      });
    }

    const fullName =
      authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null;

    const { user, isNewUser } = await this.userService.syncUser({
      supabaseId: authUser.id,
      phone: authUser.phone ?? null,
      email: verifiedEmail,
      fullName,
    });

    if (!user.isActive || user.isBlocked) {
      throw new UnauthorizedException({
        success: false,
        message: 'Account is inactive or blocked',
        code: 'ACCOUNT_UNAVAILABLE',
      });
    }
        // Customer portal access is identity-based.
        // Permanent account role (admin/user) remains unchanged.

    return {
      success: true,
      message: 'Email login successful',
      portal: 'customer',
      role: 'CUSTOMER',
      accessToken: session.access_token,
      user: this.buildCustomerUserPayload(user, isNewUser),
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in ?? 0,
        expiresAt: session.expires_at ?? null,
        tokenType: session.token_type ?? 'bearer',
      },
      nextStep: this.getCustomerNextStep(user),
    };
  }
  async loginWithGoogle(
    accessToken: string,
    portal: 'customer' | 'astrologer' | 'joinAstrologer' = 'customer',
  ) {
    const normalizedAccessToken = accessToken?.trim();

    if (!normalizedAccessToken) {
      throw new BadRequestException({
        success: false,
        message: 'Google access token is required',
        code: 'GOOGLE_TOKEN_REQUIRED',
      });
    }

    if (!['customer', 'astrologer', 'joinAstrologer'].includes(portal)) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid Google login portal',
        code: 'INVALID_GOOGLE_PORTAL',
      });
    }

    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase.auth.getUser(
        normalizedAccessToken,
      );

      if (error || !data.user) {
        throw new UnauthorizedException({
          success: false,
          message: 'Invalid Google authentication session',
          code: 'INVALID_GOOGLE_SESSION',
        });
      }

      const authUser = data.user;
      const email = authUser.email?.trim().toLowerCase() ?? null;

      if (!email) {
        throw new UnauthorizedException({
          success: false,
          message: 'Google account email is required',
          code: 'GOOGLE_EMAIL_REQUIRED',
        });
      }

      const fullName =
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        null;

      const { user, isNewUser } = await this.userService.syncUser({
        supabaseId: authUser.id,
        phone: authUser.phone ?? null,
        email,
        fullName,
      });

      if (!user.isActive || user.isBlocked) {
        throw new UnauthorizedException({
          success: false,
          message: 'Account is inactive or blocked',
          code: 'ACCOUNT_UNAVAILABLE',
        });
      }

      const fullUser = await this.userService.getUserWithRelations(
        user.supabaseId,
      );

      if (!fullUser) {
        throw new NotFoundException({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // ----------------------------------------------------
      // CUSTOMER
      // Preserve the existing Google customer behaviour.
      // ----------------------------------------------------

      if (portal === 'customer') {
        // Customer portal access is identity-based.
        // Permanent account role (admin/user) remains unchanged.

        return {
          success: true,
          message: 'Google login successful',
          portal: 'customer',
          role: 'CUSTOMER',
          user: this.buildCustomerUserPayload(user, isNewUser),
          nextStep: this.getCustomerNextStep(user),
        };
      }

      // ----------------------------------------------------
      // ASTROLOGER LOGIN
      // Existing/non-approved astrologers can never bypass
      // the existing approval gate.
      // ----------------------------------------------------

      if (portal === 'astrologer') {
        if (!fullUser.isAstrologer) {
          throw new UnauthorizedException({
            success: false,
            message: 'Astrologer access is not enabled for this account',
            code: 'ASTROLOGER_ACCESS_DENIED',
          });
        }

        const astrologer = this.buildAstrologerPayload(fullUser);

        const nextStep = !astrologer.hasAstrologerProfile
          ? 'COMPLETE_ASTROLOGER_ONBOARDING'
          : astrologer.isApproved && astrologer.isVerified
            ? 'OPEN_ASTROLOGER_DASHBOARD'
            : 'WAIT_FOR_ADMIN_APPROVAL';

        return {
          success: true,
          message: 'Google astrologer login successful',
          portal: 'astrologer',
          role: 'ASTROLOGER',
          user: {
            ...this.buildCustomerUserPayload(user, isNewUser),
            role: 'ASTROLOGER',
            portal: 'astrologer',
            accountRole: fullUser.role?.name ?? 'ASTROLOGER',
            isAstrologer: true,
          },
          astrologer,
          nextStep,
        };
      }

      // ----------------------------------------------------
      // JOIN AS ASTROLOGER
      //
      // Google verifies identity/email, but a brand-new Google
      // applicant normally has no verified mobile number.
      // We do NOT bypass the existing mobile verification.
      // ----------------------------------------------------

      const hasAstrologerProfile = Boolean(fullUser.astrologer);

      const isApprovedAstrologer =
        hasAstrologerProfile &&
        Boolean(fullUser.astrologer?.isApproved) &&
        Boolean(fullUser.astrologer?.isVerified);

      const hasMobileNumber = Boolean(fullUser.phone?.trim());

      const nextStep = !hasAstrologerProfile
        ? hasMobileNumber
          ? 'COMPLETE_ASTROLOGER_ONBOARDING'
          : 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING'
        : isApprovedAstrologer
          ? 'OPEN_ASTROLOGER_DASHBOARD'
          : 'WAIT_FOR_ADMIN_APPROVAL';

      return {
        success: true,
        message:
          nextStep === 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING'
            ? 'Google account verified. Verify your mobile number to continue your astrologer application.'
            : hasAstrologerProfile
              ? 'Astrologer application found'
              : 'Continue your astrologer application.',
        portal: 'joinAstrologer',
        role: 'ASTROLOGER_APPLICANT',
        user: {
          ...this.buildCustomerUserPayload(user, isNewUser),
          portal: 'joinAstrologer',
          accountRole: fullUser.role?.name ?? 'USER',
          isAstrologer: Boolean(fullUser.isAstrologer),
        },
        astrologer: {
          hasAstrologerProfile,
          astrologerId: fullUser.astrologer?.id ?? null,
          isApproved: fullUser.astrologer?.isApproved ?? false,
          isVerified: fullUser.astrologer?.isVerified ?? false,
        },
        nextStep,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const message = this.getErrorMessage(error);

      this.logger.error(
        `Google login failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException({
        success: false,
        message: 'Google login failed. Please try again.',
        code: 'GOOGLE_LOGIN_FAILED',
      });
    }
  }
}

