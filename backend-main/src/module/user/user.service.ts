import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { BadRequestException } from '@nestjs/common';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Gender, Prisma } from '@prisma/client';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

const authUserInclude = Prisma.validator<Prisma.UserInclude>()({
  role: true,
  subscriptionPlan: true,
  astrologer: true,
  userProfile: true,
});

type UserProfileCompletionShape = {
  fullName: string | null;
  dateOfBirth: Date | null;
  timeOfBirth: string | null;
  birthTimeKnown: boolean;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: number | null;
  gender: Gender | null;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Resolves a Supabase auth UUID to the canonical ASP User.
   *
   * Explicit UserAuthIdentity mapping wins.
   * Legacy User.supabaseId remains the fallback for accounts
   * which have not yet been backfilled.
   *
   * Always returns authUserInclude so callers retain the exact
   * relation shape they previously received.
   */
  async revokeFirebaseAccountSessions(firebaseUid: string): Promise<void> {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin credentials are unavailable');
    }

    const app =
      getApps().find((existing) => existing.name === 'asp-account-revocation') ??
      initializeApp(
        {
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        },
        'asp-account-revocation',
      );

    await getAuth(app).revokeRefreshTokens(firebaseUid);
  }
  async getAccountDeletionIdentities(supabaseId: string) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user || !user.isActive || user.isBlocked) {
      throw new UnauthorizedException('Account unavailable');
    }

    const identities = await this.prisma.userAuthIdentity.findMany({
      where: { userId: user.id },
      select: {
        provider: true,
        providerUserId: true,
      },
    });

    const firebaseUids = identities
      .filter((identity) => identity.provider === 'firebase')
      .map((identity) => identity.providerUserId);

    const supabaseUids = identities
      .filter((identity) => identity.provider === 'supabase')
      .map((identity) => identity.providerUserId);

    return {
      userId: user.id,
      firebaseUids: [...new Set(firebaseUids)],
      supabaseUids: [...new Set(supabaseUids)],
    };
  }
  async revokeAccountDeletionSessions(supabaseId: string): Promise<void> {
    const identities = await this.getAccountDeletionIdentities(supabaseId);

    for (const firebaseUid of identities.firebaseUids) {
      await this.revokeFirebaseAccountSessions(firebaseUid);
    }

    for (const supabaseUid of identities.supabaseUids) {
      await this.supabaseService.revokeAccountSessions(supabaseUid);
    }
  }
  async assertAccountDeletionEligible(supabaseId: string): Promise<void> {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user || !user.isActive || user.isBlocked) {
      throw new UnauthorizedException('Account unavailable');
    }

    if (user.isAstrologer || user.astrologer) {
      throw new BadRequestException(
        'Astrologer account deletion requires support review',
      );
    }

    const activeDeletionCalls = await this.prisma.callSession.count({
      where: {
        userId: user.id,
        endedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeDeletionCalls > 0) {
      throw new BadRequestException(
        'Please finish your active consultation before deleting your account',
      );
    }

    const pendingDeletionPayments = await this.prisma.paymentOrder.count({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
    });

    if (pendingDeletionPayments > 0) {
      throw new BadRequestException(
        'Please resolve pending payments before deleting your account',
      );
    }
    const deletionSupportAttachments = await this.prisma.supportAttachment.count({
      where: {
        ticket: {
          customerId: user.id,
        },
      },
    });

    if (deletionSupportAttachments > 0) {
      throw new BadRequestException(
        'Support attachments require privacy review before account deletion',
      );
    }
    const deletionPersonalChats = await this.prisma.chatMessage.count({
      where: {
        senderId: user.id,
      },
    });

    if (deletionPersonalChats > 0) {
      throw new BadRequestException(
        'Personal chat history requires privacy review before account deletion',
      );
    }
    const deletionChatAttachments = await this.prisma.chatMessage.count({
      where: {
        senderId: user.id,
        OR: [
          { attachmentPath: { not: null } },
          { attachmentUrl: { not: null } },
        ],
      },
    });

    if (deletionChatAttachments > 0) {
      throw new BadRequestException(
        'Chat attachments require privacy review before account deletion',
      );
    }
    const savedDeletionKundlis = await this.prisma.kundliSavedRecord.count({
      where: { customerUserId: user.id },
    });

    if (savedDeletionKundlis > 0) {
      throw new BadRequestException(
        'Saved Kundli records require privacy review before account deletion',
      );
    }
    const activeDeletionTickets = await this.prisma.supportTicket.count({
      where: {
        customerId: user.id,
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'],
        },
      },
    });

    if (activeDeletionTickets > 0) {
      throw new BadRequestException(
        'Please resolve your open support requests before deleting your account',
      );
    }
    const pendingOrders = await this.prisma.marketplaceOrder.count({
      where: {
        customerUserId: user.id,
        status: {
          in: ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING'] as any,
        },
      },
    });

    if (pendingOrders > 0) {
      throw new BadRequestException(
        'Please resolve pending orders before deleting your account',
      );
    }
  }
  // ACCOUNT_DELETION_STORAGE_INSPECTION_V1
  // Read-only inventory for a future verified storage cleanup.
  private async getAccountDeletionStorageInventory(userId: string) {
    const [chatAttachments, supportAttachments] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: {
          callSession: { userId },
          attachmentPath: { not: null },
        },
        select: { attachmentPath: true },
      }),
      this.prisma.supportAttachment.findMany({
        where: {
          ticket: { customerId: userId },
        },
        select: {
          storageBucket: true,
          storagePath: true,
        },
      }),
    ]);

    return {
      chat: chatAttachments
        .map((item) => item.attachmentPath)
        .filter((path): path is string => Boolean(path)),
      support: supportAttachments,
    };
  }
  // ACCOUNT_DELETION_STORAGE_CLEANUP_V1
  // Must run only after ownership and eligibility checks.
  private async cleanupAccountDeletionStorage(userId: string): Promise<void> {
    const inventory = await this.getAccountDeletionStorageInventory(userId);

    const client = this.supabaseService.getStorageClient();

    const chatPaths = [...new Set(inventory.chat)];

    for (const path of chatPaths) {
      if (!path.startsWith('/') && path.trim()) {
        const { error } = await client.storage
          .from('chat')
          .remove([path]);

        if (error) {
          throw new Error('Chat attachment cleanup failed');
        }
      } else {
        throw new Error('Invalid chat attachment path');
      }
    }

    for (const attachment of inventory.support) {
      if (
        attachment.storageBucket !== 'support' ||
        !attachment.storagePath.trim()
      ) {
        throw new Error('Invalid support attachment reference');
      }

      const { error } = await client.storage
        .from('support')
        .remove([attachment.storagePath]);

      if (error) {
        throw new Error('Support attachment cleanup failed');
      }
    }
  }
  async executeAccountDeletion(supabaseId: string) {
    await this.assertAccountDeletionEligible(supabaseId);

    const identities = await this.getAccountDeletionIdentities(supabaseId);

    // ACCOUNT_DELETION_STORAGE_GUARD_V1
    // Do not deactivate accounts while attachment cleanup is unresolved.
    const account = await this.resolveUserBySupabaseId(supabaseId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const inventory = await this.getAccountDeletionStorageInventory(
      account.id,
    );

    if (inventory.chat.length > 0 || inventory.support.length > 0) {
      throw new BadRequestException(
        'Stored attachments require verified cleanup before account deletion',
      );
    }

    const result = await this.deactivateAccount(supabaseId);

    const revocationResults = await Promise.allSettled([
      ...identities.firebaseUids.map((uid) =>
        this.revokeFirebaseAccountSessions(uid),
      ),
      ...identities.supabaseUids.map((uid) =>
        this.supabaseService.revokeAccountSessions(uid),
      ),
    ]);

    const failedRevocations = revocationResults.filter(
      (item) => item.status === 'rejected',
    );

    if (failedRevocations.length > 0) {
      console.error(
        'Account deletion session revocation requires retry',
        failedRevocations.length,
      );
    }

    return result;
  }
  async deactivateAccount(supabaseId: string) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('Account already deactivated');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          isBlocked: true,
          isVerified: false,
          isProfileComplete: false,
          name: null,
          avatarUrl: null,
          email: null,
          phone: null,
          gender: null,
          lastLoginAt: null,
        },
      });

      await tx.userAuthIdentity.updateMany({
        where: { userId: user.id },
        data: {
          email: null,
          phone: null,
        },
      });
      await tx.aiAstroConversation.deleteMany({
        where: { userId: user.id },
      });

      await tx.assistantConversation.deleteMany({
        where: { customerId: user.id },
      });

      // ACCOUNT_DELETION_KUNDLI_PRIVACY_V1
      // Anonymize customer-owned saved Kundli records.
      // Keep shared Kundli and financial records intact.
      await tx.kundliSavedRecord.updateMany({
        where: {
          customerUserId: user.id,
        },
        data: {
          name: 'Deleted customer',
          gender: null,
          birthPlace: null,
          customerUserId: null,
        },
      });
      // ACCOUNT_DELETION_PRIVACY_V2
      // Remove customer chat content without deleting financial sessions.
      await tx.chatMessage.updateMany({
        where: {
          callSession: { userId: user.id },
        },
        data: {
          content: null,
          encryptedContent: null,
          encryptionNonce: null,
          encryptionMac: null,
          encryptionVersion: null,
          attachmentUrl: null,
          attachmentPath: null,
          attachmentName: null,
          attachmentMimeType: null,
          attachmentSize: null,
          audioDurationMs: null,
        },
      });

      // Anonymize support content while retaining ticket references.
      await tx.supportMessage.updateMany({
        where: {
          ticket: { customerId: user.id },
        },
        data: {
          content: '[Removed following account deletion]',
        },
      });

      await tx.supportTicket.updateMany({
        where: { customerId: user.id },
        data: {
          contactEmail: null,
          subject: 'Deleted customer request',
          description: null,
        },
      });

      // Retain orders and payment evidence, anonymize delivery details.
      await tx.marketplaceOrder.updateMany({
        where: { customerUserId: user.id },
        data: {
          fullName: 'Deleted customer',
          phone: '',
          addressLine1: '',
          addressLine2: null,
          landmark: null,
          city: '',
          state: '',
          postalCode: '',
          country: '',
          countryCode: null,
        },
      });
      await tx.dailyHoroscopeHistory.deleteMany({
        where: { userId: user.id },
      });
      await tx.marketplaceAddress.deleteMany({
        where: { userId: user.id },
      });

      await tx.userPreference.deleteMany({
        where: { userId: user.id },
      });

      const deletionProfiles = await tx.profile.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      const deletionProfileIds = deletionProfiles.map(
        (profile) => profile.id,
      );

      if (deletionProfileIds.length > 0) {
        const linkedMatches = await tx.match.count({
          where: {
            OR: [
              { boyId: { in: deletionProfileIds } },
              { girlId: { in: deletionProfileIds } },
            ],
          },
        });

        if (linkedMatches > 0) {
          throw new BadRequestException(
            'Linked compatibility records require review before account deletion',
          );
        }
      }
      await tx.profile.deleteMany({
        where: { userId: user.id },
      });
      await tx.pushDevice.deleteMany({
        where: { userId: user.id },
      });

      await tx.appNotification.deleteMany({
        where: { userId: user.id },
      });
      await tx.userProfile.deleteMany({
        where: { userId: user.id },
      });
    });

    return {
      success: true,
      message: 'Account deactivated successfully',
    };
  }
  async assertActiveAccount(supabaseId: string): Promise<void> {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user) {
      throw new UnauthorizedException(
        'Customer account not registered',
      );
    }

    if (!user.isActive || user.isBlocked) {
      throw new UnauthorizedException('This account is unavailable');
    }
  }
  private async resolveUserBySupabaseId(supabaseId: string) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      return null;
    }

    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedSupabaseId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (identity) {
      return this.prisma.user.findUnique({
        where: {
          id: identity.userId,
        },
        include: authUserInclude,
      });
    }

    return this.prisma.user.findUnique({
      where: {
        supabaseId: normalizedSupabaseId,
      },
      include: authUserInclude,
    });
  }

  async getUserWithRelations(supabaseId: string) {
    return this.resolveUserBySupabaseId(supabaseId);
  }
  private async resolveCanonicalUserId(
    supabaseId: string,
  ): Promise<string | null> {
    const user = await this.resolveUserBySupabaseId(supabaseId);
    return user?.id ?? null;
  }

  /**
   * Store and compare phone identities in one canonical E.164-like form.
   * Supabase may return the verified phone without the leading "+".
   */
  private normalizePhoneIdentity(phone?: string | null): string | null {
    const raw = phone?.trim();

    if (!raw) {
      return null;
    }

    const digits = raw.replace(/\D/g, '');

    if (!digits) {
      return null;
    }

    return `+${digits}`;
  }

  async getUserWithRelationsByPhone(phone: string) {
    const normalizedPhone = this.normalizePhoneIdentity(phone);

    if (!normalizedPhone) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: {
        phone: normalizedPhone,
      },
      include: authUserInclude,
    });
  }
  private isUserProfileComplete(profile: UserProfileCompletionShape | null) {
    if (!profile) {
      return false;
    }

    return Boolean(
      profile.fullName &&
      profile.dateOfBirth &&
      (profile.birthTimeKnown === false || profile.timeOfBirth) &&
      profile.city &&
      profile.countryCode &&
      profile.latitude != null &&
      profile.longitude != null &&
      profile.timezone != null &&
      profile.gender,
    );
  }

  private getUserNextStep(isProfileComplete: boolean) {
    return isProfileComplete ? 'OPEN_HOME' : 'COMPLETE_PROFILE';
  }

  private normalizeLocationData(dto: any) {
    const location =
      typeof dto.location === 'string' ? dto.location.trim() : '';

    if (!location) {
      return {};
    }

    const parts = location
      .split(',')
      .map((x: string) => x.trim())
      .filter(Boolean);

    const country =
      typeof dto.country === 'string' && dto.country.trim()
        ? dto.country.trim()
        : (parts[2] ?? null);

    const explicitCountryCode =
      typeof dto.countryCode === 'string' && dto.countryCode.trim()
        ? dto.countryCode.trim().toUpperCase()
        : null;

    const isIndia =
      country?.trim().toLowerCase() === 'india' ||
      parts.some((part: string) => part.trim().toLowerCase() === 'india');

    return {
      city: dto.city ?? parts[0] ?? null,
      state: dto.state ?? parts[1] ?? null,
      country,
      countryCode: explicitCountryCode ?? (isIndia ? 'IN' : null),
      timezoneName: dto.timezoneName ?? (isIndia ? 'Asia/Kolkata' : null),
    };
  }

  private buildCreateUserProfileData(dto: CreateUserProfileDto) {
    return {
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      timeOfBirth: dto.birthTimeKnown === false ? null : dto.timeOfBirth,
      birthTimeKnown: dto.birthTimeKnown ?? true,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      timezoneName: dto.timezoneName,
      ...this.normalizeLocationData(dto),
      gender: dto.gender,
      location: dto.location,
      avatarUrl: dto.avatarUrl,
      lang: dto.lang,
    };
  }

  private buildUpdateUserProfileData(dto: UpdateUserProfileDto) {
    return {
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      timeOfBirth: dto.birthTimeKnown === false ? null : dto.timeOfBirth,
      birthTimeKnown: dto.birthTimeKnown ?? true,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      residenceCountryCode: dto.residenceCountryCode,
      timezoneName: dto.timezoneName,
      ...this.normalizeLocationData(dto),
      gender: dto.gender,
      location: dto.location,
      avatarUrl: dto.avatarUrl,
      lang: dto.lang,
    };
  }

  async getUserByFirebaseUid(firebaseUid: string) {
    const uid = firebaseUid?.trim();

    if (!uid) {
      return null;
    }

    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'firebase',
          providerUserId: uid,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!identity) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: {
        id: identity.userId,
      },
      include: authUserInclude,
    });
  }
  async syncFirebaseEmailUser(data: {
    firebaseUid: string;
    email: string;
  }) {
    const firebaseUid = data.firebaseUid?.trim();
    const email = data.email?.trim().toLowerCase();

    if (!firebaseUid || !email) {
      throw new BadRequestException(
        'Firebase UID and verified email are required',
      );
    }

    // First priority: an already-linked Firebase identity.
    const existingIdentity =
      await this.prisma.userAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'firebase',
            providerUserId: firebaseUid,
          },
        },
        select: {
          id: true,
          userId: true,
          email: true,
        },
      });

    if (existingIdentity) {
      const mappedUser = await this.prisma.user.findUnique({
        where: { id: existingIdentity.userId },
        include: authUserInclude,
      });

      if (!mappedUser) {
        throw new InternalServerErrorException(
          'Firebase identity has no customer account',
        );
      }

      if (!mappedUser.isActive || mappedUser.isBlocked) {
        throw new UnauthorizedException('This account is unavailable');
      }

      const mappedEmail = mappedUser.email?.trim().toLowerCase();

      if (mappedEmail && mappedEmail !== email) {
        throw new ConflictException(
          'Firebase email does not match the linked customer',
        );
      }

      if (!mappedEmail) {
        const emailOwner = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (emailOwner && emailOwner.id !== mappedUser.id) {
          throw new ConflictException(
            'Email already belongs to another customer',
          );
        }

        await this.prisma.user.update({
          where: { id: mappedUser.id },
          data: { email },
        });
      }

      // One Firebase UID can represent linked Firebase credentials.
      // Preserve the existing identity row and enrich it with email.
      if (
        !existingIdentity.email ||
        existingIdentity.email.trim().toLowerCase() !== email
      ) {
        await this.prisma.userAuthIdentity.update({
          where: { id: existingIdentity.id },
          data: { email },
        });
      }

      const freshMappedUser = await this.prisma.user.findUnique({
        where: { id: mappedUser.id },
        include: authUserInclude,
      });

      if (!freshMappedUser) {
        throw new InternalServerErrorException(
          'Customer could not be loaded after Firebase email login',
        );
      }

      return {
        user: freshMappedUser,
        isNewUser: false,
      };
    }

    // No Firebase UID mapping yet.
    // Reuse the existing ASP account with the SAME VERIFIED EMAIL.
    // This is what makes Google login + Firebase email login
    // open the same canonical dashboard/account.
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: authUserInclude,
    });

    let isNewUser = false;

    if (user && (!user.isActive || user.isBlocked)) {
      throw new UnauthorizedException('This account is unavailable');
    }

    if (!user) {
      const role = await this.prisma.role.findUnique({
        where: { name: 'CUSTOMER' },
      });

      if (!role) {
        throw new InternalServerErrorException(
          'Default customer role not found',
        );
      }

      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { name: 'FREE' },
      });

      if (!freePlan) {
        throw new InternalServerErrorException(
          'FREE subscription plan not found',
        );
      }

      const internalAuthId = `firebase:${firebaseUid}`;

      user = await this.prisma.user.create({
        data: {
          supabaseId: internalAuthId,
          phone: null,
          email,
          name: null,
          roleId: role.id,
          isProfileComplete: false,
          freeChatGrantedAt: new Date(),
          freeChatUsedAt: null,
          freeChatMinutes: 1,
          subscriptionPlanId: freePlan.id,
          subscriptionStatus: 'FREE',
        },
        include: authUserInclude,
      });

      isNewUser = true;
    }

    const identityCheck =
      await this.prisma.userAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'firebase',
            providerUserId: firebaseUid,
          },
        },
        select: {
          userId: true,
        },
      });

    if (identityCheck && identityCheck.userId !== user.id) {
      throw new ConflictException(
        'Firebase identity belongs to another customer',
      );
    }

    if (!identityCheck) {
      await this.prisma.userAuthIdentity.create({
        data: {
          userId: user.id,
          provider: 'firebase',
          providerUserId: firebaseUid,
          identityType: 'email',
          email,
          phone: null,
          isPrimary: false,
        },
      });
    }

    const freshUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: authUserInclude,
    });

    if (!freshUser) {
      throw new InternalServerErrorException(
        'Customer could not be loaded after Firebase email login',
      );
    }

    return {
      user: freshUser,
      isNewUser,
    };
  }
  async syncFirebasePhoneUser(data: { firebaseUid: string; phone: string }) {
    const firebaseUid = data.firebaseUid?.trim();
    const phone = this.normalizePhoneIdentity(data.phone);

    if (!firebaseUid || !phone) {
      throw new BadRequestException(
        'Firebase UID and verified phone are required',
      );
    }

    const existingIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'firebase',
          providerUserId: firebaseUid,
        },
      },
      select: {
        userId: true,
      },
    });

    if (existingIdentity) {
      const mappedUser = await this.prisma.user.findUnique({
        where: {
          id: existingIdentity.userId,
        },
        include: authUserInclude,
      });

      if (!mappedUser) {
        throw new InternalServerErrorException(
          'Firebase identity has no customer account',
        );
      }

      // Customer portal access is identity-based.
      // Keep the permanent DB role (admin/user/etc.) unchanged.
      // The verified Firebase identity controls authentication here.

      if (!mappedUser.isActive || mappedUser.isBlocked) {
        throw new UnauthorizedException('This account is unavailable');
      }
      const mappedPhone = this.normalizePhoneIdentity(mappedUser.phone);

      if (mappedPhone && mappedPhone !== phone) {
        throw new ConflictException(
          'Firebase phone does not match the linked customer',
        );
      }

      if (!mappedPhone) {
        const phoneOwner = await this.prisma.user.findUnique({
          where: { phone },
          select: { id: true },
        });

        if (phoneOwner && phoneOwner.id !== mappedUser.id) {
          throw new ConflictException(
            'Phone number already belongs to another account',
          );
        }

        const updatedUser = await this.prisma.user.update({
          where: { id: mappedUser.id },
          data: { phone },
          include: authUserInclude,
        });

        return {
          user: updatedUser,
          isNewUser: false,
        };
      }

      return {
        user: mappedUser,
        isNewUser: false,
      };
    }

    // Existing customer with same verified phone.
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: authUserInclude,
    });

    let isNewUser = false;

    if (user && (!user.isActive || user.isBlocked)) {
      throw new UnauthorizedException('This account is unavailable');
    }
    if (user) {
      // Existing verified phone: reuse the canonical ASP account.
      // Do not change its permanent role and do not create another wallet.
    } else {
      // Brand-new Firebase customer.
      const role = await this.prisma.role.findUnique({
        where: { name: 'CUSTOMER' },
      });

      if (!role) {
        throw new InternalServerErrorException(
          'Default customer role not found',
        );
      }

      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { name: 'FREE' },
      });

      if (!freePlan) {
        throw new InternalServerErrorException(
          'FREE subscription plan not found',
        );
      }

      // Current User schema requires supabaseId.
      // This is an internal canonical auth identifier.
      const internalAuthId = `firebase:${firebaseUid}`;

      user = await this.prisma.user.create({
        data: {
          supabaseId: internalAuthId,
          phone,
          email: null,
          name: null,
          roleId: role.id,
          isProfileComplete: false,

          freeChatGrantedAt: new Date(),
          freeChatUsedAt: null,
          freeChatMinutes: 1,

          subscriptionPlanId: freePlan.id,
          subscriptionStatus: 'FREE',
        },
        include: authUserInclude,
      });

      isNewUser = true;
    }

    const identityCheck = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'firebase',
          providerUserId: firebaseUid,
        },
      },
      select: {
        userId: true,
      },
    });

    if (identityCheck && identityCheck.userId !== user.id) {
      throw new ConflictException(
        'Firebase identity belongs to another customer',
      );
    }

    if (!identityCheck) {
      await this.prisma.userAuthIdentity.create({
        data: {
          userId: user.id,
          provider: 'firebase',
          providerUserId: firebaseUid,
          identityType: 'phone',
          phone,
          email: null,
          isPrimary: false,
        },
      });
    }

    const freshUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: authUserInclude,
    });

    if (!freshUser) {
      throw new InternalServerErrorException(
        'Customer could not be loaded after Firebase login',
      );
    }

    return {
      user: freshUser,
      isNewUser,
    };
  }
  async syncUser(data: {
    supabaseId: string;
    phone?: string | null;
    email?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
  }) {
    try {
      const supabaseId = data.supabaseId?.trim();
      const phone = this.normalizePhoneIdentity(data.phone);
      const email = data.email?.trim().toLowerCase() || null;
      const fullName = data.fullName?.trim() || null;

      if (!supabaseId) {
        throw new InternalServerErrorException('Supabase user ID is required');
      }

      const role = await this.prisma.role.findUnique({
        where: { name: 'CUSTOMER' },
      });

      if (!role) {
        throw new InternalServerErrorException('Default role not found');
      }

      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { name: 'FREE' },
      });

      if (!freePlan) {
        throw new InternalServerErrorException(
          'Default FREE subscription plan not found',
        );
      }

      // 1. Strongest identity:
      // explicit auth mapping first, legacy User.supabaseId second.
      let existingUser = await this.resolveUserBySupabaseId(supabaseId);

      // 2. Account linking:
      // Google/Supabase can return a new auth identity for an email that
      // already belongs to an ASP customer. Reuse that customer instead
      // of creating a duplicate database account.
      if (!existingUser && email) {
        existingUser = await this.prisma.user.findUnique({
          where: { email },
          include: authUserInclude,
        });
      }

      // 3. Phone is another unique verified identity used by OTP login.
      if (!existingUser && phone) {
        existingUser = await this.prisma.user.findUnique({
          where: { phone },
          include: authUserInclude,
        });
      }

      let user: Prisma.UserGetPayload<{
        include: typeof authUserInclude;
      }>;

      let isNewUser = false;

      if (existingUser && (!existingUser.isActive || existingUser.isBlocked)) {
        throw new UnauthorizedException('This account is unavailable');
      }
      if (existingUser) {
        // Only an explicit provider mapping may bridge a temporary
        // legacy duplicate. Email/name matching alone never links users.
        const mappedIdentity = await this.prisma.userAuthIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'supabase',
              providerUserId: supabaseId,
            },
          },
          select: {
            userId: true,
          },
        });

        const isExplicitlyMapped = mappedIdentity?.userId === existingUser.id;

        // CUSTOMER_IDENTITY_ROLE_GUARD
        // An unrecognized customer Supabase identity must never be linked
        // to a privileged/non-customer account through phone/email fallback.
        if (!isExplicitlyMapped && existingUser.role?.name !== 'CUSTOMER') {
          throw new ConflictException(
            'This sign-in identity cannot be linked to this customer account',
          );
        }

        // Preserve collision protection for every unlinked account.
        if (email && !isExplicitlyMapped) {
          const emailOwner = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });

          if (emailOwner && emailOwner.id !== existingUser.id) {
            throw new ConflictException(
              'This email address belongs to another account',
            );
          }
        }

        if (phone && !isExplicitlyMapped) {
          const phoneOwner = await this.prisma.user.findUnique({
            where: { phone },
            select: { id: true },
          });

          if (phoneOwner && phoneOwner.id !== existingUser.id) {
            throw new ConflictException(
              'This phone number belongs to another account',
            );
          }
        }

        const supabaseOwner = await this.prisma.user.findUnique({
          where: { supabaseId },
          select: { id: true },
        });

        if (
          supabaseOwner &&
          supabaseOwner.id !== existingUser.id &&
          !isExplicitlyMapped
        ) {
          throw new ConflictException(
            'This authentication account is already linked to another user',
          );
        }

        const isProfileComplete = this.isUserProfileComplete(
          existingUser.userProfile,
        );

        user = await this.prisma.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            // Preserve the canonical/primary Supabase UUID.
            // Secondary UUIDs live in UserAuthIdentity.
            ...(phone && !existingUser.phone ? { phone } : {}),

            // Do not claim an email still owned by a temporary legacy
            // duplicate. It will be moved only during verified FK merge.
            ...(email && !existingUser.email && !isExplicitlyMapped
              ? { email }
              : {}),

            ...(fullName && !existingUser.name ? { name: fullName } : {}),
            isProfileComplete,
          },
          include: authUserInclude,
        });

        this.logger.log(`User account linked/synced successfully: ${user.id}`);
      } else {
        isNewUser = true;

        user = await this.prisma.user.create({
          data: {
            supabaseId,
            phone,
            email,
            name: fullName,
            roleId: role.id,
            isProfileComplete: false,
            freeChatGrantedAt: new Date(),
            freeChatUsedAt: null,
            freeChatMinutes: 1,
            subscriptionPlanId: freePlan.id,
            subscriptionStatus: 'FREE',
          },
          include: authUserInclude,
        });

        this.logger.log(
          `New customer account created successfully: ${user.id}`,
        );
      }

      // AUTH_IDENTITY_CANONICAL_SYNC
      const existingIdentity = await this.prisma.userAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'supabase',
            providerUserId: supabaseId,
          },
        },
        select: { userId: true },
      });

      if (existingIdentity && existingIdentity.userId !== user.id) {
        throw new ConflictException(
          'This authentication identity is already linked to another account',
        );
      }

      if (!existingIdentity) {
        await this.prisma.userAuthIdentity.create({
          data: {
            userId: user.id,
            provider: 'supabase',
            providerUserId: supabaseId,
            identityType: phone ? 'phone' : email ? 'email' : 'supabase',
            email,
            phone,
            isPrimary: true,
          },
        });
      }

      return {
        user,
        isNewUser,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : String(error.meta?.target ?? 'email or phone');

        this.logger.warn(
          `User sync conflict for Supabase ID ${data.supabaseId}. Target: ${target}`,
        );

        throw new ConflictException(
          'An account already exists with this email address or phone number',
        );
      }

      if (
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `User sync failed for Supabase ID ${data.supabaseId}: ${message}`,
      );

      throw new InternalServerErrorException('Failed to sync user account');
    }
  }
  async findBySupabaseId(supabaseId: string) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async ensureAstrologerProfileBySupabaseId(supabaseId: string) {
    const user = await this.findBySupabaseId(supabaseId);

    if (!user.isAstrologer || user.astrologer) {
      return user;
    }

    this.logger.log(
      `Creating astrologer profile for user ${user.id} (${user.supabaseId})`,
    );

    await this.prisma.astrologer.create({
      data: {
        userId: user.id,
        languages: [],
      },
    });

    return this.findBySupabaseId(supabaseId);
  }

  async getProfile(supabaseId: string) {
    const canonicalUserId = await this.resolveCanonicalUserId(supabaseId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: canonicalUserId ?? '__canonical_user_not_found__',
      },
      select: {
        id: true,
        phone: true,
        isProfileComplete: true,
        userProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const canonicalPhone = this.normalizePhoneIdentity(user.phone);

    let profile = user.userProfile;

    if (profile && canonicalPhone && !profile.phoneNumber?.trim()) {
      profile = await this.prisma.userProfile.update({
        where: {
          userId: user.id,
        },
        data: {
          phoneNumber: canonicalPhone,
        },
      });
    }

    const verifiedPhoneIdentity = canonicalPhone
      ? await this.prisma.userAuthIdentity.findFirst({
          where: {
            userId: user.id,
            provider: { in: ['firebase', 'supabase_phone_verified'] },
            identityType: 'phone',
            phone: canonicalPhone,
          },
          select: { userId: true },
        })
      : null;

    return {
      success: true,
      data: profile,
      isPhoneVerified: verifiedPhoneIdentity !== null,
      isProfileComplete: user.isProfileComplete,
      nextStep: this.getUserNextStep(user.isProfileComplete),
    };
  }

  private async validateProfileLanguage(
    language?: string,
    useDatabaseDefault = false,
  ): Promise<string | undefined> {
    const normalized = language?.trim().toLowerCase();

    if (!normalized) {
      if (!useDatabaseDefault) {
        return undefined;
      }

      const defaultLanguage = await this.prisma.appLanguage.findFirst({
        where: {
          isActive: true,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            englishName: 'asc',
          },
        ],
        select: {
          code: true,
        },
      });

      if (!defaultLanguage) {
        throw new BadRequestException(
          'No active application language is configured',
        );
      }

      return defaultLanguage.code;
    }

    const activeLanguage = await this.prisma.appLanguage.findUnique({
      where: {
        code: normalized,
      },
      select: {
        code: true,
        isActive: true,
      },
    });

    if (!activeLanguage || !activeLanguage.isActive) {
      throw new BadRequestException('Selected language is not available');
    }

    return activeLanguage.code;
  }

  async createProfile(supabaseId: string, dto: CreateUserProfileDto) {
    dto.lang = await this.validateProfileLanguage(dto.lang, true);

    const user = await this.prisma.user.findUnique({
      where: {
        id:
          (await this.resolveCanonicalUserId(supabaseId)) ??
          '__canonical_user_not_found__',
      },
      select: {
        id: true,
        userProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userProfile) {
      throw new ConflictException('User profile already exists');
    }

    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const createdProfile = await tx.userProfile.create({
          data: {
            userId: user.id,
            ...this.buildCreateUserProfileData(dto),
          },
        });

        const isProfileComplete = this.isUserProfileComplete(createdProfile);

        await tx.user.update({
          where: { id: user.id },
          data: { isProfileComplete },
        });

        return createdProfile;
      });

      const isProfileComplete = this.isUserProfileComplete(profile);

      return {
        success: true,
        message: 'User profile created successfully',
        data: profile,
        isProfileComplete,
        nextStep: this.getUserNextStep(isProfileComplete),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A unique user profile field already exists',
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create profile for Supabase ID ${supabaseId}: ${message}`,
      );

      throw new InternalServerErrorException('Failed to create user profile');
    }
  }

  async verifyFirebaseProfilePhoneToken(firebaseIdToken: string) {
    const token = firebaseIdToken?.trim();

    if (!token) {
      throw new BadRequestException('Firebase ID token is required');
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

    if (!projectId || !clientEmail || !privateKey) {
      throw new InternalServerErrorException(
        'Firebase Admin credentials are unavailable',
      );
    }

    const app =
      getApps().find((candidate) => candidate.options.projectId === projectId) ??
      initializeApp(
        {
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          projectId,
        },
        `profile-phone-${projectId}`,
      );

    let decoded;

    try {
      decoded = await getAuth(app).verifyIdToken(token, true);
    } catch {
      throw new UnauthorizedException('Invalid Firebase verification token');
    }

    const phone = decoded.phone_number?.trim();
    const firebaseUid = decoded.uid?.trim();

    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone) || !firebaseUid) {
      throw new UnauthorizedException(
        'Firebase verified phone identity is missing',
      );
    }

    return { phone, firebaseUid };
  }
  async inspectAccountLinkSafety(supabaseId: string) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [
      wallet,
      subscriptions,
      paymentOrders,
      savedKundlis,
      kundliOrders,
      walletLedger,
      chatMessages,
      callSessions,
      marketplaceOrders,
      aiConversations,
    ] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: { userId: user.id },
        select: {
          balance: true,
          paidBalance: true,
          freeBalance: true,
          lockedBalance: true,
        },
      }),
      this.prisma.subscription.count({
        where: {
          userId: user.id,
          OR: [
            { subscriptionStatus: { not: 'FREE' } },
            { razorpaySubscriptionId: { not: null } },
            { razorpayPaymentId: { not: null } },
            { razorpayOrderId: { not: null } },
            { amount: { gt: 0 } },
          ],
        },
      }),
      this.prisma.paymentOrder.count({
        where: { userId: user.id },
      }),
      this.prisma.kundliSavedRecord.count({
        where: { customerUserId: user.id },
      }),
      this.prisma.kundliOrder.count({
        where: { userId: user.id },
      }),
      this.prisma.walletLedger.count({
        where: { userId: user.id },
      }),
      this.prisma.chatMessage.count({
        where: { senderId: user.id },
      }),
      this.prisma.callSession.count({
        where: { userId: user.id },
      }),
      this.prisma.marketplaceOrder.count({
        where: { customerUserId: user.id },
      }),
      this.prisma.aiAstroConversation.count({
        where: { userId: user.id },
      }),
    ]);

    const hasWalletValue = wallet
      ? [
          wallet.balance,
          wallet.paidBalance,
          wallet.freeBalance,
          wallet.lockedBalance,
        ].some((value) => !value.isZero())
      : false;

    return {
      userId: user.id,
      requiresManualReview:
        hasWalletValue ||
        subscriptions > 0 ||
        paymentOrders > 0 ||
        savedKundlis > 0 ||
        kundliOrders > 0 ||
        walletLedger > 0 ||
        chatMessages > 0 ||
        callSessions > 0 ||
        marketplaceOrders > 0 ||
        aiConversations > 0,
      checks: {
        hasWalletValue,
        subscriptions,
        paymentOrders,
        savedKundlis,
        kundliOrders,
        walletLedger,
        chatMessages,
        callSessions,
        marketplaceOrders,
        aiConversations,
      },
    };
  }
  async linkFirebaseVerifiedProfilePhone(
    supabaseId: string,
    firebaseIdToken: string,
    confirmAccountLink = false,
  ) {
    const { phone, firebaseUid } =
      await this.verifyFirebaseProfilePhoneToken(firebaseIdToken);

    const canonicalUserId = await this.resolveCanonicalUserId(supabaseId);

    if (!canonicalUserId) {
      throw new NotFoundException('User not found');
    }

    const existingPhoneOwner = await this.prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: canonicalUserId },
      },
      select: { id: true },
    });

    if (existingPhoneOwner) {
      const googleAccount = await this.prisma.user.findUnique({
        where: { id: canonicalUserId },
        select: {
          id: true,
          phone: true,
          isActive: true,
          isBlocked: true,
        },
      });

      if (!googleAccount || !googleAccount.isActive || googleAccount.isBlocked) {
        throw new ConflictException({
          code: 'ACCOUNT_LINK_UNAVAILABLE',
          message: 'This account cannot be linked.',
          accountLinkRequired: false,
        });
      }

      if (googleAccount.phone && googleAccount.phone !== phone) {
        throw new ConflictException({
          code: 'ACCOUNT_LINK_PHONE_CONFLICT',
          message: 'This account already has a different phone number.',
          accountLinkRequired: false,
        });
      }

      const googleAccountSafety =
        await this.inspectAccountLinkSafety(supabaseId);

      if (googleAccountSafety.requiresManualReview) {
        throw new ConflictException({
          code: 'ACCOUNT_LINK_MANUAL_REVIEW',
          message:
            'This Google account contains existing activity. ' +
            'Automatic linking is blocked to protect your data.',
          accountLinkRequired: false,
        });
      }

      if (confirmAccountLink !== true) {
        throw new ConflictException({
          code: 'PHONE_ACCOUNT_LINK_REQUIRED',
          message:
            'This verified phone belongs to an existing account. ' +
            'Account linking requires explicit confirmation.',
          accountLinkRequired: true,
        });
      }

      // ACCOUNT_LINK_SAFETY_HOLD_V2
      // Automatic linking remains disabled unless explicitly enabled.
      if (process.env.ACCOUNT_LINKING_ENABLED !== 'true') {
        throw new ConflictException({
          code: 'ACCOUNT_LINK_TEMPORARILY_UNAVAILABLE',
          message: 'Account linking is temporarily unavailable for safety.',
        });
      }

      // ACCOUNT_LINK_VERIFIED_CANONICAL_V1
      // Keep the verified phone account as the canonical customer.
      // Never merge wallets, payments, Kundlis or other customer data.
      const linkedUserId = await this.prisma.$transaction(async (tx) => {
        // ACCOUNT_LINK_TX_SAFETY_V2
        const [
          wallet,
          subscriptions,
          payments,
          kundlis,
          kundliOrders,
          ledger,
          chats,
          calls,
          marketplace,
          conversations,
        ] = await Promise.all([
          tx.wallet.findUnique({
            where: { userId: canonicalUserId },
            select: {
              balance: true,
              paidBalance: true,
              freeBalance: true,
              lockedBalance: true,
            },
          }),
          tx.subscription.count({
            where: {
              userId: canonicalUserId,
              OR: [
                { subscriptionStatus: { not: 'FREE' } },
                { razorpaySubscriptionId: { not: null } },
                { razorpayPaymentId: { not: null } },
                { razorpayOrderId: { not: null } },
                { amount: { gt: 0 } },
              ],
            },
          }),
          tx.paymentOrder.count({ where: { userId: canonicalUserId } }),
          tx.kundliSavedRecord.count({
            where: { customerUserId: canonicalUserId },
          }),
          tx.kundliOrder.count({ where: { userId: canonicalUserId } }),
          tx.walletLedger.count({ where: { userId: canonicalUserId } }),
          tx.chatMessage.count({ where: { senderId: canonicalUserId } }),
          tx.callSession.count({ where: { userId: canonicalUserId } }),
          tx.marketplaceOrder.count({
            where: { customerUserId: canonicalUserId },
          }),
          tx.aiAstroConversation.count({
            where: { userId: canonicalUserId },
          }),
        ]);

        const hasWalletValue = wallet
          ? [
              wallet.balance,
              wallet.paidBalance,
              wallet.freeBalance,
              wallet.lockedBalance,
            ].some((value) => !value.isZero())
          : false;

        if (
          hasWalletValue ||
          subscriptions > 0 ||
          payments > 0 ||
          kundlis > 0 ||
          kundliOrders > 0 ||
          ledger > 0 ||
          chats > 0 ||
          calls > 0 ||
          marketplace > 0 ||
          conversations > 0
        ) {
          throw new ConflictException({
            code: 'ACCOUNT_LINK_MANUAL_REVIEW',
            message: 'Google account contains existing activity.',
          });
        }
        const [phoneOwner, googleOwner, supabaseIdentity, firebaseIdentity] =
          await Promise.all([
            tx.user.findUnique({
              where: { id: existingPhoneOwner.id },
              select: {
                id: true,
                phone: true,
                isActive: true,
                isBlocked: true,
                role: { select: { name: true } },
              },
            }),
            tx.user.findUnique({
              where: { id: canonicalUserId },
              select: {
                id: true,
                phone: true,
                isActive: true,
                isBlocked: true,
                role: { select: { name: true } },
              },
            }),
            tx.userAuthIdentity.findUnique({
              where: {
                provider_providerUserId: {
                  provider: 'supabase',
                  providerUserId: supabaseId,
                },
              },
              select: { id: true, userId: true },
            }),
            tx.userAuthIdentity.findUnique({
              where: {
                provider_providerUserId: {
                  provider: 'firebase',
                  providerUserId: firebaseUid,
                },
              },
              select: { userId: true },
            }),
          ]);

        if (
          !phoneOwner ||
          phoneOwner.phone !== phone ||
          !phoneOwner.isActive ||
          phoneOwner.isBlocked ||
          phoneOwner.role?.name !== 'CUSTOMER' ||
          !googleOwner ||
          !googleOwner.isActive ||
          googleOwner.isBlocked ||
          googleOwner.role?.name !== 'CUSTOMER' ||
          (googleOwner.phone && googleOwner.phone !== phone)
        ) {
          throw new ConflictException({
            code: 'ACCOUNT_LINK_UNAVAILABLE',
            message: 'These customer accounts cannot be linked.',
          });
        }

        if (
          firebaseIdentity &&
          firebaseIdentity.userId !== phoneOwner.id
        ) {
          throw new ConflictException({
            code: 'ACCOUNT_LINK_PHONE_IDENTITY_CONFLICT',
            message: 'Verified phone identity belongs to another account.',
          });
        }

        if (
          supabaseIdentity &&
          supabaseIdentity.userId !== googleOwner.id &&
          supabaseIdentity.userId !== phoneOwner.id
        ) {
          throw new ConflictException({
            code: 'ACCOUNT_LINK_IDENTITY_CONFLICT',
            message: 'Google identity belongs to another account.',
          });
        }

        if (supabaseIdentity) {
          await tx.userAuthIdentity.update({
            where: { id: supabaseIdentity.id },
            data: { userId: phoneOwner.id },
          });
        } else {
          await tx.userAuthIdentity.create({
            data: {
              userId: phoneOwner.id,
              provider: 'supabase',
              providerUserId: supabaseId,
              identityType: 'email',
              isPrimary: false,
            },
          });
        }

                // ACCOUNT_LINK_FIREBASE_IDENTITY_V1
        // Bind the verified Firebase UID to the canonical phone account.
        if (!firebaseIdentity) {
          await tx.userAuthIdentity.create({
            data: {
              userId: phoneOwner.id,
              provider: 'firebase',
              providerUserId: firebaseUid,
              identityType: 'phone',
              phone,
              isPrimary: false,
            },
          });
        }
return phoneOwner.id;
      }, {
        // ACCOUNT_LINK_SERIALIZABLE_V1
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 15000,
      });

      return {
        success: true,
        message: 'Google identity linked to existing phone account.',
        data: {
          accountLinked: true,
          canonicalUserId: linkedUserId,
          phone,
        },
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: canonicalUserId },
        select: { phone: true },
      });

      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      if (currentUser.phone && currentUser.phone !== phone) {
        throw new ConflictException(
          'This account already has a different linked phone number',
        );
      }

      const conflictingPhoneIdentity = await tx.userAuthIdentity.findFirst({
        where: {
          phone,
          userId: { not: canonicalUserId },
          identityType: 'phone',
          provider: { in: ['firebase', 'supabase_phone_verified'] },
        },
        select: { id: true },
      });

      if (conflictingPhoneIdentity) {
        throw new ConflictException(
          'This verified phone belongs to another account',
        );
      }
      const existingFirebaseIdentity =
        await tx.userAuthIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'firebase',
              providerUserId: firebaseUid,
            },
          },
          select: { userId: true },
        });

      if (
        existingFirebaseIdentity &&
        existingFirebaseIdentity.userId !== canonicalUserId
      ) {
        throw new ConflictException(
          'Firebase phone identity belongs to another account',
        );
      }

      const otherPhoneOwner = await tx.user.findFirst({
        where: {
          phone,
          NOT: { id: canonicalUserId },
        },
        select: { id: true },
      });

      if (otherPhoneOwner) {
        throw new ConflictException(
          'Phone number is already linked to another account',
        );
      }

      const user = await tx.user.update({
        where: { id: canonicalUserId },
        data: { phone },
        select: { id: true, phone: true },
      });

      const profile = await tx.userProfile.update({
        where: { userId: canonicalUserId },
        data: { phoneNumber: phone },
      });

      await tx.userAuthIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: 'firebase',
            providerUserId: firebaseUid,
          },
        },
        create: {
          userId: canonicalUserId,
          provider: 'firebase',
          providerUserId: firebaseUid,
          identityType: 'phone',
          phone,
          isPrimary: false,
        },
        update: {
          phone,
          identityType: 'phone',
        },
      });

      return { user, profile };
    });

    return {
      success: true,
      message: 'Firebase phone verified and linked successfully',
      data: {
        phone: result.user.phone,
        profile: result.profile,
      },
    };
  }
  async sendProfilePhoneOtp(supabaseId: string, phone: string) {
    const normalizedPhone = phone?.trim();

    if (!normalizedPhone || !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      throw new BadRequestException(
        'Enter a valid phone number with country code',
      );
    }

    const canonicalUserId = await this.resolveCanonicalUserId(supabaseId);

    if (!canonicalUserId) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        NOT: { id: canonicalUserId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'This phone number is already linked to another account',
      );
    }

    await this.supabaseService.sendOtp(normalizedPhone);

    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }

  async verifyAndLinkProfilePhone(
    supabaseId: string,
    phone: string,
    token: string,
  ) {
    const normalizedPhone = phone?.trim();
    const normalizedToken = token?.trim();

    if (!normalizedPhone || !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      throw new BadRequestException(
        'Enter a valid phone number with country code',
      );
    }

    if (!normalizedToken) {
      throw new BadRequestException('OTP is required');
    }

    const canonicalUserId = await this.resolveCanonicalUserId(supabaseId);

    if (!canonicalUserId) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        NOT: { id: canonicalUserId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'This phone number is already linked to another account',
      );
    }

    const verified = await this.supabaseService.verifyPhoneOtpForLinking(
      normalizedPhone,
      normalizedToken,
    );

    if (verified.phone !== normalizedPhone) {
      throw new BadRequestException('Verified phone number does not match');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: canonicalUserId },
        data: {
          phone: normalizedPhone,
        },
        select: {
          id: true,
          phone: true,
        },
      });

      const profile = await tx.userProfile.update({
        where: { userId: canonicalUserId },
        data: {
          phoneNumber: normalizedPhone,
        },
      });

      const existingVerifiedPhone = await tx.userAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'supabase_phone_verified',
            providerUserId: normalizedPhone,
          },
        },
        select: { userId: true },
      });

      if (existingVerifiedPhone &&
          existingVerifiedPhone.userId !== canonicalUserId) {
        throw new ConflictException(
          'This phone number is already verified by another account',
        );
      }

      await tx.userAuthIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: 'supabase_phone_verified',
            providerUserId: normalizedPhone,
          },
        },
        create: {
          userId: canonicalUserId,
          provider: 'supabase_phone_verified',
          providerUserId: normalizedPhone,
          identityType: 'phone',
          phone: normalizedPhone,
          isPrimary: false,
        },
        update: {
          phone: normalizedPhone,
          identityType: 'phone',
        },
      });

      return { user, profile };
    });

    return {
      success: true,
      message: 'Phone number verified and linked successfully',
      data: {
        phone: result.user.phone,
        profile: result.profile,
      },
    };
  }
  async updateProfile(supabaseId: string, dto: UpdateUserProfileDto) {
    if (dto.lang !== undefined) {
      dto.lang = await this.validateProfileLanguage(dto.lang);
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id:
          (await this.resolveCanonicalUserId(supabaseId)) ??
          '__canonical_user_not_found__',
      },
      select: {
        id: true,
        userProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.userProfile) {
      throw new NotFoundException('User profile not found');
    }

    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const updatedProfile = await tx.userProfile.update({
          where: { userId: user.id },
          data: this.buildUpdateUserProfileData(dto),
        });

        const isProfileComplete = this.isUserProfileComplete(updatedProfile);

        await tx.user.update({
          where: { id: user.id },
          data: { isProfileComplete },
        });

        return updatedProfile;
      });

      const isProfileComplete = this.isUserProfileComplete(profile);

      return {
        success: true,
        message: 'User profile updated successfully',
        data: profile,
        isProfileComplete,
        nextStep: this.getUserNextStep(isProfileComplete),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A unique user profile field already exists',
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to update profile for Supabase ID ${supabaseId}: ${message}`,
      );

      throw new InternalServerErrorException('Failed to update user profile');
    }
  }

  async findAll(page = 1, limit = 10) {
    try {
      return await this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          role: true,
          subscriptionPlan: true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch users: ${message}`);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        subscriptionPlan: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(
    id: string,
    data: {
      phone?: string;
      fullName?: string;
      gender?: Gender;
      birthDate?: Date;
      birthTime?: string;
      birthPlace?: string;
      profileImage?: string;
      isProfileComplete?: boolean;
    },
  ) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update user ${id}: ${message}`);

      throw new InternalServerErrorException('Failed to update user profile');
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete user ${id}: ${message}`);

      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
