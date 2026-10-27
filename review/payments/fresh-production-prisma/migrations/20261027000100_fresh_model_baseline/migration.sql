BEGIN;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') THEN RAISE EXCEPTION 'Fresh empty production target required; historical database prohibited'; END IF; END $$;
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('CLOUD', 'LOCAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'FAILED', 'PAUSED', 'FREE', 'TRIAL');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('RECHARGE', 'RECHARGE_REFUND', 'CALL_DEDUCTION', 'AI_ASTRO_DEDUCTION', 'REFUND', 'BONUS', 'PENALTY', 'WITHDRAWAL', 'GIFT_SENT', 'GIFT_RECEIVED');

-- CreateEnum
CREATE TYPE "LedgerReferenceType" AS ENUM ('WALLET_RECHARGE', 'CALL_SESSION', 'AI_ASTRO_USAGE', 'GIFT', 'KUNDLI_REPORT', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('WALLET_RECHARGE', 'KUNDLI_REPORT', 'SUBSCRIPTION', 'GIFT_PURCHASE');

-- CreateEnum
CREATE TYPE "AstrologerEarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "AstrologerPayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KundliOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'STICKER', 'FILE', 'AUDIO', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "UserReportReason" AS ENUM ('ABUSIVE_LANGUAGE', 'HARASSMENT', 'SPAM', 'FRAUD_OR_SCAM', 'SEXUAL_OR_INAPPROPRIATE_CONTENT', 'HATE_OR_THREATS', 'OFF_PLATFORM_PAYMENT', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "UserReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_TAKEN', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LiveConnectionRole" AS ENUM ('PUBLISHER', 'SUBSCRIBER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('GENERAL', 'CONSULTATION', 'PAYMENT', 'WALLET', 'ACCOUNT', 'ASTROLOGER', 'TECHNICAL', 'ASSISTANT_ESCALATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AssistantConversationStatus" AS ENUM ('ACTIVE', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssistantSenderType" AS ENUM ('CUSTOMER', 'ASSISTANT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('GENERAL', 'APP_EXPERIENCE', 'ASTROLOGY_CONTENT', 'PAYMENT', 'CONSULTATION', 'TECHNICAL', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MarketplaceSellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarketplaceProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketplaceCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplaceDiscountType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "MarketplaceAdminActionType" AS ENUM ('SELLER_ACTIVATED', 'SELLER_SUSPENDED', 'SELLER_REJECTED', 'PRODUCT_APPROVED', 'PRODUCT_REJECTED', 'PRODUCT_DISABLED', 'PRODUCT_FEATURED', 'PRODUCT_UNFEATURED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DISABLED', 'CAMPAIGN_CREATED', 'CAMPAIGN_UPDATED', 'CAMPAIGN_ACTIVATED', 'CAMPAIGN_PAUSED', 'CAMPAIGN_CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplacePaymentExceptionStatus" AS ENUM ('REFUND_REQUIRED', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_FAILED');

-- CreateEnum
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplaceFulfillmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplaceEarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAYOUT_REQUESTED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "MarketplacePayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AstrologerKundliReportStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "ArticlePublicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ArticleAuthorType" AS ENUM ('ADMIN', 'ASTROLOGER');

-- CreateTable
CREATE TABLE "ConsultationBirthSharing" (
    "profileRef" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "consultationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "birthVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultationBirthSharing_pkey" PRIMARY KEY ("consultationId")
);

-- CreateTable
CREATE TABLE "ConsultationBirthSharingAudit" (
    "profileRef" TEXT NOT NULL,
    "birthVersion" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationBirthSharingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "gender" "Gender",
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAstrologer" BOOLEAN NOT NULL DEFAULT false,
    "isNewUser" BOOLEAN NOT NULL DEFAULT true,
    "freeChatGrantedAt" TIMESTAMP(3),
    "freeChatUsedAt" TIMESTAMP(3),
    "freeChatMinutes" INTEGER NOT NULL DEFAULT 1,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "razorpayCustomerId" TEXT,
    "subscriptionPlanId" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'supabase',
    "providerUserId" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Astrologer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileUrl" TEXT,
    "aiAvatarUrl" TEXT,
    "Gender" "Gender",
    "bio" TEXT,
    "languages" TEXT[],
    "consultationCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience" INTEGER,
    "pricePerMin" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "documents" JSONB,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Astrologer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expertise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Expertise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerExpertise" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "expertiseId" TEXT NOT NULL,

    CONSTRAINT "AstrologerExpertise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timezone" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTime" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "city" TEXT,
    "countryCode" TEXT,
    "country" TEXT,
    "fullname" TEXT,
    "state" TEXT,
    "timezoneName" TEXT,
    "avatarUrl" TEXT,
    "maritalStatus" TEXT,
    "occupation" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "boyId" TEXT NOT NULL,
    "girlId" TEXT NOT NULL,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KundliData" (
    "id" TEXT NOT NULL,
    "apiVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentMahaDasha" JSONB,
    "kundliId" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "vedic" JSONB,

    CONSTRAINT "KundliData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kundli" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" DOUBLE PRECISION NOT NULL,
    "hash" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "tob" TEXT NOT NULL,

    CONSTRAINT "Kundli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kundli_saved_records" (
    "id" TEXT NOT NULL,
    "kundliId" TEXT NOT NULL,
    "createdByAstrologerId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "birthPlace" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kundli_saved_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionPlanId" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "amount" DECIMAL(12,3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "razorpaySubscriptionId" TEXT,
    "razorpayCustomerId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "nextBillingAt" TIMESTAMP(3),
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "durationDays" INTEGER NOT NULL,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "razorpayPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freeBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rawWebhook" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'WALLET_RECHARGE',
    "metadata" JSONB,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KundliOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "kundliId" TEXT,
    "status" "KundliOrderStatus" NOT NULL DEFAULT 'PENDING',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KundliOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" "LedgerReferenceType",

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "ratePerMinute" DOUBLE PRECISION NOT NULL,
    "purchasedMinutes" INTEGER NOT NULL,
    "extendedMinutes" INTEGER NOT NULL DEFAULT 0,
    "amountCharged" DOUBLE PRECISION NOT NULL,
    "isFreeChat" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL DEFAULT 'audio',
    "astrologyQuestionId" TEXT,
    "astrologyQuestionText" TEXT,
    "astrologyCategorySlug" TEXT,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationFinancialPolicy" (
    "callSessionId" TEXT NOT NULL,
    "platformPercent" DECIMAL(5,2) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycle" TEXT NOT NULL,

    CONSTRAINT "ConsultationFinancialPolicy_pkey" PRIMARY KEY ("callSessionId")
);

-- CreateTable
CREATE TABLE "CommissionPolicyAudit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "previousPercent" DECIMAL(5,2) NOT NULL,
    "newPercent" DECIMAL(5,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPolicyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCreationCommand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "quoteHash" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCreationCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminFinanceAction" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminFinanceAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_earnings" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "payoutId" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platformFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "AstrologerEarningStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_payouts" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentCountryCode" TEXT,
    "paymentCurrency" TEXT,
    "paymentAmount" DECIMAL(18,6),
    "paymentFxRate" DECIMAL(18,8),
    "paymentFxQuotedAt" TIMESTAMP(3),
    "razorpayAmountSubunits" DECIMAL(20,0),
    "status" "AstrologerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerReference" TEXT,
    "idempotencyKey" TEXT,
    "providerStatus" TEXT,
    "providerStatusDetails" JSONB,
    "lastWebhookAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_bank_accounts" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bankName" TEXT,
    "providerContactId" TEXT,
    "providerFundAccountId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "encryptedContent" TEXT,
    "encryptionNonce" TEXT,
    "encryptionMac" TEXT,
    "encryptionVersion" INTEGER,
    "attachmentUrl" TEXT,
    "attachmentPath" TEXT,
    "attachmentName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSize" INTEGER,
    "audioDurationMs" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientMessageId" TEXT,
    "replyToMessageId" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chartStyle" TEXT NOT NULL DEFAULT 'NORTH_INDIAN',
    "monthType" TEXT NOT NULL DEFAULT 'AMANT',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "hideOuterPlanets" BOOLEAN NOT NULL DEFAULT false,
    "customCalendar" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "timeOfBirth" TEXT,
    "birthTimeKnown" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" DOUBLE PRECISION,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "residenceCountryCode" TEXT,
    "timezoneName" TEXT,
    "gender" "Gender" NOT NULL,
    "location" TEXT,
    "avatarUrl" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_horoscope_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "requestedDay" TEXT NOT NULL,
    "vedic" JSONB NOT NULL,
    "ai" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "providerSource" TEXT NOT NULL,
    "aiModel" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_horoscope_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizedHoroscopeReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "locale" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "profileFingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'GENERATING',
    "response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizedHoroscopeReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoroscopeNotificationPreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "HoroscopeNotificationOutbox" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "locale" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL DEFAULT 'horoscope',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "providerResponse" JSONB,
    "failureCode" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoroscopeSubscriptionControl" (
    "subscriptionId" TEXT NOT NULL,
    "renewalMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeSubscriptionControl_pkey" PRIMARY KEY ("subscriptionId")
);

-- CreateTable
CREATE TABLE "HoroscopeSubscriptionAudit" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoroscopeSubscriptionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerAvailability" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "platformCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "videoCallEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyQuestionCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyQuestionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyQuestion" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerQualificationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questionCount" INTEGER NOT NULL DEFAULT 10,
    "passingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "allowRetake" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER,
    "retakeCooldownMins" INTEGER NOT NULL DEFAULT 0,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT true,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT false,
    "showScore" BOOLEAN NOT NULL DEFAULT true,
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerQualificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerQualificationQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "category" TEXT,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerQualificationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerQualificationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "passingScore" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerQualificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_encryption_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_encryption_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "callSessionId" TEXT,
    "reason" "UserReportReason" NOT NULL,
    "details" TEXT,
    "status" "UserReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReceptionistSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerSessionId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'DEMO',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "language" TEXT NOT NULL DEFAULT 'AUTO',
    "customerPhone" TEXT,
    "customerUserId" TEXT,
    "failureReason" TEXT,
    "transferReason" TEXT,
    "transferredTo" TEXT,
    "startedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReceptionistSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReceptionistMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sequenceNumber" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReceptionistMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "connectionProtocol" INTEGER NOT NULL DEFAULT 1,
    "hostConnectionId" TEXT,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveMessage" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveViewer" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "LiveViewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveConnection" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LiveConnectionRole" NOT NULL,
    "agoraUid" INTEGER NOT NULL,
    "resumeSecretHash" TEXT NOT NULL,
    "joinRequestId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "lastResumeRequestId" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacyViewerId" TEXT,

    CONSTRAINT "LiveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_pricing" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "pricePerQuestion" DECIMAL(12,2),
    "pricingMode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
    "pricePerMinute" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT,
    "personaId" TEXT,
    "clientRequestId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "consultantTypeCode" TEXT,
    "amountCharged" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_astro_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT,
    "personaId" TEXT,
    "consultantTypeCode" TEXT,
    "startingCategory" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_astro_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contactEmail" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" TEXT,
    "relatedCallSessionId" TEXT,
    "relatedPaymentId" TEXT,
    "relatedWalletTxnId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "customerLastReadAt" TIMESTAMP(3),
    "adminLastReadAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportOperationAudit" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportOperationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPrivateNote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportPrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportDelivery" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(6),
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackContext" (
    "feedbackId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,

    CONSTRAINT "FeedbackContext_pkey" PRIMARY KEY ("feedbackId")
);

-- CreateTable
CREATE TABLE "FeedbackEscalation" (
    "feedbackId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,

    CONSTRAINT "FeedbackEscalation_pkey" PRIMARY KEY ("feedbackId")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderType" "SupportSenderType" NOT NULL,
    "senderUserId" TEXT,
    "content" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "AssistantConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "supportTicketId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "AssistantSenderType" NOT NULL,
    "senderUserId" TEXT,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "model" TEXT,
    "clientMessageId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "shareMessage" TEXT NOT NULL,
    "androidStoreUrl" TEXT,
    "iosStoreUrl" TEXT,
    "websiteUrl" TEXT,
    "aboutTitle" TEXT,
    "aboutDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSellerProfile" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "status" "MarketplaceSellerStatus" NOT NULL DEFAULT 'PENDING',
    "shopDisplayName" TEXT,
    "shopBio" TEXT,
    "suspensionReason" TEXT,
    "rejectionReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mrp" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "shippingCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "status" "MarketplaceProductStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "festivalKey" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "bannerImageUrl" TEXT,
    "discountType" "MarketplaceDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "maxDiscount" DECIMAL(12,2),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "MarketplaceCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCampaignProduct" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "overrideDiscountType" "MarketplaceDiscountType",
    "overrideDiscountValue" DECIMAL(12,2),
    "overrideMaxDiscount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCampaignProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAdminAction" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" "MarketplaceAdminActionType" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceAdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerUserId" TEXT,
    "prepareIdempotencyKey" TEXT,
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentCountryCode" TEXT,
    "paymentCurrency" TEXT,
    "paymentAmount" DECIMAL(18,6),
    "paymentFxRate" DECIMAL(18,8),
    "paymentFxQuotedAt" TIMESTAMP(3),
    "razorpayAmountSubunits" DECIMAL(20,0),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shippingTotal" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "paymentVerifiedAt" TIMESTAMP(3),
    "paymentWebhookEventId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCheckoutSnapshot" (
    "orderId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCheckoutSnapshot_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "MarketplacePaymentCommand" (
    "orderId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CREATING',
    "providerOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePaymentCommand_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "MarketplaceSellerOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "astrologerId" TEXT,
    "status" "MarketplaceFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "sellerDisplayName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shippingTotal" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "trackingCarrier" TEXT,
    "trackingNumber" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrderItem" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mrp" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shippingCharge" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSellerEarning" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "payoutId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "platformFeePercent" DECIMAL(5,2) NOT NULL,
    "platformFeeAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "MarketplaceEarningStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSellerPayout" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "MarketplacePayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerReference" TEXT,
    "idempotencyKey" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_payment_exceptions" (
    "id" TEXT NOT NULL,
    "marketplaceOrderId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT NOT NULL,
    "status" "MarketplacePaymentExceptionStatus" NOT NULL DEFAULT 'REFUND_REQUIRED',
    "razorpayRefundId" TEXT,
    "refundFailureReason" TEXT,
    "refundRequestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_payment_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_languages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_translations" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_personas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "initials" TEXT,
    "categories" TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['English', 'Hindi']::TEXT[],
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pricingMode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "pricePerMinute" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_consultant_types" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresKundli" BOOLEAN NOT NULL DEFAULT false,
    "safetyProfile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_consultant_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ai_astro_sessions" (
    "id" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT,
    "personaId" TEXT,
    "consultantTypeCode" TEXT NOT NULL,
    "pricingMode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
    "ratePerMinute" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reservedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "chargedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "billableSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recharge_packs" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "bonusPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recharge_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_kundli_reports" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "status" "AstrologerKundliReportStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "summary" TEXT,
    "character" TEXT,
    "career" TEXT,
    "marriage" TEXT,
    "finance" TEXT,
    "health" TEXT,
    "remedies" TEXT,
    "notes" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_kundli_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_kundli_report_attachments" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "astrologer_kundli_report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrology_question_answer_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "kundliHash" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "questionUpdatedAt" TIMESTAMP(3) NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrology_question_answer_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyVideo" (
    "id" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ASTROLOGY_LESSONS',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "visibilityCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyVideoTranslation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "captionUrl" TEXT,
    "audioLocale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyVideoTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ASTROLOGY',
    "festivalTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "visibilityCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "authorType" "ArticleAuthorType" NOT NULL DEFAULT 'ADMIN',
    "status" "ArticlePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedByAstrologerId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyArticleTranslation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentMarkdown" TEXT NOT NULL,
    "authorName" TEXT,
    "readingMinutes" INTEGER NOT NULL DEFAULT 3,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AstrologerFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAstroFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAstroFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KundliGenerationConsent" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "astrologerUserId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "birthDataVersion" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "fieldScope" TEXT[],
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "KundliGenerationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KundliGenerationConsentAudit" (
    "id" BIGSERIAL NOT NULL,
    "consentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KundliGenerationConsentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KundliGenerationRequest" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "leaseExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL,
    "savedRecordId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KundliGenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartNotificationPolicy" (
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "controlVersion" INTEGER NOT NULL DEFAULT 1,
    "scheduleMinute" INTEGER NOT NULL DEFAULT 540,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "entitlement" TEXT NOT NULL DEFAULT 'UNAPPROVED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "dailyLimit" INTEGER NOT NULL DEFAULT 1,
    "minimumIntervalMs" INTEGER NOT NULL DEFAULT 86400000,
    "quietStart" INTEGER NOT NULL DEFAULT 1320,
    "quietEnd" INTEGER NOT NULL DEFAULT 480,

    CONSTRAINT "SmartNotificationPolicy_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "SmartNotificationConsent" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "birthUse" BOOLEAN NOT NULL DEFAULT false,
    "engagementGranted" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "SmartNotificationConsent_pkey" PRIMARY KEY ("userId","category")
);

-- CreateTable
CREATE TABLE "SmartNotificationCampaign" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provenance" TEXT NOT NULL DEFAULT 'ADMIN_EDITORIAL',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "scheduledAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartNotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartNotificationInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '[]',
    "sourceVersion" TEXT NOT NULL,
    "generationKey" TEXT,
    "consentVersion" INTEGER NOT NULL,
    "policyRevision" INTEGER NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SmartNotificationInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartNotificationDelivery" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(6),
    "resultCode" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMPTZ(6),

    CONSTRAINT "SmartNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartNotificationAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartNotificationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartNotificationOpen" (
    "insightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartNotificationOpen_pkey" PRIMARY KEY ("insightId")
);

-- CreateTable
CREATE TABLE "MarketplaceOrderCase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrderCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceRefundAttempt" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "policyRevision" TEXT NOT NULL,
    "componentSnapshot" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PREPARED',
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "providerRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceRefundAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceRefundAttemptEvent" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "attemptId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceRefundAttemptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceFinancialEntry" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "productMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "shippingMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL,
    "sellerMinor" BIGINT NOT NULL,
    "platformMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceFinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminModerationSubject" (
    "kind" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminModerationSubject_pkey" PRIMARY KEY ("kind","userId")
);

-- CreateTable
CREATE TABLE "AdminModerationAudit" (
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "nextState" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminModerationAudit_pkey" PRIMARY KEY ("requestId")
);

-- CreateIndex
CREATE INDEX "ConsultationBirthSharingAudit_consultationId_createdAt_idx" ON "ConsultationBirthSharingAudit"("consultationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_supabaseId_idx" ON "User"("supabaseId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_isAstrologer_idx" ON "User"("isAstrologer");

-- CreateIndex
CREATE INDEX "user_auth_identities_userId_idx" ON "user_auth_identities"("userId");

-- CreateIndex
CREATE INDEX "user_auth_identities_email_idx" ON "user_auth_identities"("email");

-- CreateIndex
CREATE INDEX "user_auth_identities_phone_idx" ON "user_auth_identities"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_identities_provider_providerUserId_key" ON "user_auth_identities"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Astrologer_userId_key" ON "Astrologer"("userId");

-- CreateIndex
CREATE INDEX "Astrologer_userId_idx" ON "Astrologer"("userId");

-- CreateIndex
CREATE INDEX "Astrologer_isApproved_idx" ON "Astrologer"("isApproved");

-- CreateIndex
CREATE INDEX "Astrologer_isVerified_idx" ON "Astrologer"("isVerified");

-- CreateIndex
CREATE INDEX "Astrologer_isOnline_idx" ON "Astrologer"("isOnline");

-- CreateIndex
CREATE INDEX "Astrologer_rating_idx" ON "Astrologer"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "Expertise_name_key" ON "Expertise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerExpertise_astrologerId_expertiseId_key" ON "AstrologerExpertise"("astrologerId", "expertiseId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_callSessionId_key" ON "Review"("callSessionId");

-- CreateIndex
CREATE INDEX "Review_astrologerId_idx" ON "Review"("astrologerId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Match_boyId_idx" ON "Match"("boyId");

-- CreateIndex
CREATE INDEX "Match_girlId_idx" ON "Match"("girlId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_boyId_girlId_key" ON "Match"("boyId", "girlId");

-- CreateIndex
CREATE UNIQUE INDEX "KundliData_kundliId_key" ON "KundliData"("kundliId");

-- CreateIndex
CREATE UNIQUE INDEX "KundliData_kundliId_lang_key" ON "KundliData"("kundliId", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "Kundli_hash_key" ON "Kundli"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "kundli_saved_records_idempotencyKey_key" ON "kundli_saved_records"("idempotencyKey");

-- CreateIndex
CREATE INDEX "kundli_saved_records_kundliId_idx" ON "kundli_saved_records"("kundliId");

-- CreateIndex
CREATE INDEX "kundli_saved_records_createdByAstrologerId_createdAt_idx" ON "kundli_saved_records"("createdByAstrologerId", "createdAt");

-- CreateIndex
CREATE INDEX "kundli_saved_records_customerUserId_createdAt_idx" ON "kundli_saved_records"("customerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_subscriptionStatus_idx" ON "Subscription"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Subscription_subscriptionPlanId_idx" ON "Subscription"("subscriptionPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_id_owner_key" ON "wallets"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_razorpayOrderId_key" ON "payment_orders"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_provider_payment_key" ON "payment_orders"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "payment_orders_userId_idx" ON "payment_orders"("userId");

-- CreateIndex
CREATE INDEX "payment_orders_walletId_idx" ON "payment_orders"("walletId");

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");

-- CreateIndex
CREATE INDEX "payment_orders_type_idx" ON "payment_orders"("type");

-- CreateIndex
CREATE UNIQUE INDEX "KundliOrder_paymentOrderId_key" ON "KundliOrder"("paymentOrderId");

-- CreateIndex
CREATE INDEX "KundliOrder_userId_idx" ON "KundliOrder"("userId");

-- CreateIndex
CREATE INDEX "wallet_ledger_walletId_idx" ON "wallet_ledger"("walletId");

-- CreateIndex
CREATE INDEX "wallet_ledger_userId_idx" ON "wallet_ledger"("userId");

-- CreateIndex
CREATE INDEX "wallet_ledger_type_idx" ON "wallet_ledger"("type");

-- CreateIndex
CREATE INDEX "CommissionPolicyAudit_effectiveAt_idx" ON "CommissionPolicyAudit"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCreationCommand_providerOrderId_key" ON "PaymentCreationCommand"("providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentCreationCommand_userId_state_idx" ON "PaymentCreationCommand"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "AdminFinanceAction_requestKey_key" ON "AdminFinanceAction"("requestKey");

-- CreateIndex
CREATE INDEX "AdminFinanceAction_referenceId_createdAt_idx" ON "AdminFinanceAction"("referenceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_earnings_callSessionId_key" ON "astrologer_earnings"("callSessionId");

-- CreateIndex
CREATE INDEX "astrologer_earnings_astrologerId_idx" ON "astrologer_earnings"("astrologerId");

-- CreateIndex
CREATE INDEX "astrologer_earnings_payoutId_idx" ON "astrologer_earnings"("payoutId");

-- CreateIndex
CREATE INDEX "astrologer_earnings_status_idx" ON "astrologer_earnings"("status");

-- CreateIndex
CREATE INDEX "astrologer_earnings_createdAt_idx" ON "astrologer_earnings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_payouts_idempotencyKey_key" ON "astrologer_payouts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "astrologer_payouts_astrologerId_idx" ON "astrologer_payouts"("astrologerId");

-- CreateIndex
CREATE INDEX "astrologer_payouts_bankAccountId_idx" ON "astrologer_payouts"("bankAccountId");

-- CreateIndex
CREATE INDEX "astrologer_payouts_status_idx" ON "astrologer_payouts"("status");

-- CreateIndex
CREATE INDEX "astrologer_payouts_createdAt_idx" ON "astrologer_payouts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_bank_accounts_providerContactId_key" ON "astrologer_bank_accounts"("providerContactId");

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_bank_accounts_providerFundAccountId_key" ON "astrologer_bank_accounts"("providerFundAccountId");

-- CreateIndex
CREATE INDEX "astrologer_bank_accounts_astrologerId_idx" ON "astrologer_bank_accounts"("astrologerId");

-- CreateIndex
CREATE INDEX "astrologer_bank_accounts_isActive_idx" ON "astrologer_bank_accounts"("isActive");

-- CreateIndex
CREATE INDEX "astrologer_bank_accounts_createdAt_idx" ON "astrologer_bank_accounts"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_callSessionId_idx" ON "chat_messages"("callSessionId");

-- CreateIndex
CREATE INDEX "chat_messages_senderId_idx" ON "chat_messages"("senderId");

-- CreateIndex
CREATE INDEX "chat_messages_isRead_idx" ON "chat_messages"("isRead");

-- CreateIndex
CREATE INDEX "chat_messages_replyToMessageId_idx" ON "chat_messages"("replyToMessageId");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_senderId_clientMessageId_key" ON "chat_messages"("senderId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_phoneNumber_key" ON "UserProfile"("phoneNumber");

-- CreateIndex
CREATE INDEX "daily_horoscope_history_userId_targetDate_idx" ON "daily_horoscope_history"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "daily_horoscope_history_generatedAt_idx" ON "daily_horoscope_history"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_horoscope_history_userId_targetDate_key" ON "daily_horoscope_history"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "PersonalizedHoroscopeReading_state_nextAttemptAt_idx" ON "PersonalizedHoroscopeReading"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "horoscope_reading_identity_key" ON "PersonalizedHoroscopeReading"("userId", "localDate", "locale", "contentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "HoroscopeNotificationOutbox_idempotencyKey_key" ON "HoroscopeNotificationOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HoroscopeNotificationOutbox_state_nextAttemptAt_idx" ON "HoroscopeNotificationOutbox"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "HoroscopeSubscriptionAudit_subscriptionId_createdAt_idx" ON "HoroscopeSubscriptionAudit"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "AstrologerAvailability_astrologerId_idx" ON "AstrologerAvailability"("astrologerId");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerAvailability_astrologerId_dayOfWeek_key" ON "AstrologerAvailability"("astrologerId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologyQuestionCategory_slug_key" ON "AstrologyQuestionCategory"("slug");

-- CreateIndex
CREATE INDEX "AstrologyQuestionCategory_isActive_sortOrder_idx" ON "AstrologyQuestionCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologyQuestion_categoryId_isActive_sortOrder_idx" ON "AstrologyQuestion"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologerQualificationQuestion_isActive_sortOrder_idx" ON "AstrologerQualificationQuestion"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologerQualificationQuestion_category_idx" ON "AstrologerQualificationQuestion"("category");

-- CreateIndex
CREATE INDEX "AstrologerQualificationAttempt_userId_idx" ON "AstrologerQualificationAttempt"("userId");

-- CreateIndex
CREATE INDEX "AstrologerQualificationAttempt_userId_passed_idx" ON "AstrologerQualificationAttempt"("userId", "passed");

-- CreateIndex
CREATE INDEX "AstrologerQualificationAttempt_createdAt_idx" ON "AstrologerQualificationAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_fcmToken_key" ON "PushDevice"("fcmToken");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- CreateIndex
CREATE INDEX "PushDevice_platform_idx" ON "PushDevice"("platform");

-- CreateIndex
CREATE INDEX "PushDevice_isActive_idx" ON "PushDevice"("isActive");

-- CreateIndex
CREATE INDEX "PushDevice_userId_isActive_idx" ON "PushDevice"("userId", "isActive");

-- CreateIndex
CREATE INDEX "chat_encryption_devices_userId_idx" ON "chat_encryption_devices"("userId");

-- CreateIndex
CREATE INDEX "chat_encryption_devices_isActive_idx" ON "chat_encryption_devices"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "chat_encryption_devices_userId_deviceId_key" ON "chat_encryption_devices"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_isActive_idx" ON "UserBlock"("blockerId", "isActive");

-- CreateIndex
CREATE INDEX "UserBlock_blockedUserId_isActive_idx" ON "UserBlock"("blockedUserId", "isActive");

-- CreateIndex
CREATE INDEX "UserBlock_createdAt_idx" ON "UserBlock"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedUserId_key" ON "UserBlock"("blockerId", "blockedUserId");

-- CreateIndex
CREATE INDEX "UserReport_reporterId_createdAt_idx" ON "UserReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "UserReport_reportedUserId_status_idx" ON "UserReport"("reportedUserId", "status");

-- CreateIndex
CREATE INDEX "UserReport_callSessionId_idx" ON "UserReport"("callSessionId");

-- CreateIndex
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_status_idx" ON "AiReceptionistSession"("status");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_provider_idx" ON "AiReceptionistSession"("provider");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_customerUserId_idx" ON "AiReceptionistSession"("customerUserId");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_customerPhone_idx" ON "AiReceptionistSession"("customerPhone");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_createdAt_idx" ON "AiReceptionistSession"("createdAt");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_startedAt_idx" ON "AiReceptionistSession"("startedAt");

-- CreateIndex
CREATE INDEX "AiReceptionistMessage_sessionId_idx" ON "AiReceptionistMessage"("sessionId");

-- CreateIndex
CREATE INDEX "AiReceptionistMessage_sessionId_createdAt_idx" ON "AiReceptionistMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiReceptionistMessage_sessionId_sequenceNumber_idx" ON "AiReceptionistMessage"("sessionId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_channelName_key" ON "LiveSession"("channelName");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_hostConnectionId_key" ON "LiveSession"("hostConnectionId");

-- CreateIndex
CREATE INDEX "LiveSession_astrologerId_status_idx" ON "LiveSession"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "LiveSession_status_startedAt_idx" ON "LiveSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "LiveMessage_liveSessionId_createdAt_idx" ON "LiveMessage"("liveSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveMessage_userId_idx" ON "LiveMessage"("userId");

-- CreateIndex
CREATE INDEX "LiveViewer_liveSessionId_leftAt_idx" ON "LiveViewer"("liveSessionId", "leftAt");

-- CreateIndex
CREATE INDEX "LiveViewer_userId_leftAt_idx" ON "LiveViewer"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "LiveViewer_liveSessionId_userId_idx" ON "LiveViewer"("liveSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveConnection_legacyViewerId_key" ON "LiveConnection"("legacyViewerId");

-- CreateIndex
CREATE INDEX "LiveConnection_liveSessionId_role_closedAt_leaseExpiresAt_idx" ON "LiveConnection"("liveSessionId", "role", "closedAt", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "LiveConnection_closedAt_leaseExpiresAt_idx" ON "LiveConnection"("closedAt", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveConnection_liveSessionId_agoraUid_key" ON "LiveConnection"("liveSessionId", "agoraUid");

-- CreateIndex
CREATE UNIQUE INDEX "LiveConnection_userId_joinRequestId_key" ON "LiveConnection"("userId", "joinRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_pricing_astrologerId_key" ON "ai_astro_pricing"("astrologerId");

-- CreateIndex
CREATE INDEX "ai_astro_pricing_isEnabled_idx" ON "ai_astro_pricing"("isEnabled");

-- CreateIndex
CREATE INDEX "ai_astro_pricing_isFree_idx" ON "ai_astro_pricing"("isFree");

-- CreateIndex
CREATE INDEX "ai_astro_usages_userId_createdAt_idx" ON "ai_astro_usages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_astro_usages_astrologerId_createdAt_idx" ON "ai_astro_usages"("astrologerId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_astro_usages_userId_isFree_idx" ON "ai_astro_usages"("userId", "isFree");

-- CreateIndex
CREATE INDEX "ai_astro_usages_consultantTypeCode_createdAt_idx" ON "ai_astro_usages"("consultantTypeCode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_usages_userId_clientRequestId_key" ON "ai_astro_usages"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "ai_astro_conversations_userId_updatedAt_idx" ON "ai_astro_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_astro_conversations_astrologerId_updatedAt_idx" ON "ai_astro_conversations"("astrologerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_astro_conversations_userId_astrologerId_idx" ON "ai_astro_conversations"("userId", "astrologerId");

-- CreateIndex
CREATE INDEX "ai_astro_conversations_userId_astrologerId_consultantTypeCo_idx" ON "ai_astro_conversations"("userId", "astrologerId", "consultantTypeCode", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_astro_messages_conversationId_createdAt_idx" ON "ai_astro_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "app_notifications_userId_idx" ON "app_notifications"("userId");

-- CreateIndex
CREATE INDEX "app_notifications_userId_isRead_idx" ON "app_notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "app_notifications_userId_createdAt_idx" ON "app_notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_customerId_createdAt_idx" ON "support_tickets"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_status_updatedAt_idx" ON "support_tickets"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "support_tickets_priority_status_idx" ON "support_tickets"("priority", "status");

-- CreateIndex
CREATE INDEX "support_tickets_assignedAdminId_status_idx" ON "support_tickets"("assignedAdminId", "status");

-- CreateIndex
CREATE INDEX "support_tickets_lastMessageAt_idx" ON "support_tickets"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_id_customerId_key" ON "support_tickets"("id", "customerId");

-- CreateIndex
CREATE INDEX "SupportOperationAudit_objectType_objectId_createdAt_idx" ON "SupportOperationAudit"("objectType", "objectId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportPrivateNote_ticketId_createdAt_idx" ON "SupportPrivateNote"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportDelivery_eventKey_key" ON "SupportDelivery"("eventKey");

-- CreateIndex
CREATE INDEX "SupportDelivery_state_nextAttemptAt_idx" ON "SupportDelivery"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FeedbackContext_consultationId_idx" ON "FeedbackContext"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackEscalation_ticketId_key" ON "FeedbackEscalation"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "support_attachments_storagePath_key" ON "support_attachments"("storagePath");

-- CreateIndex
CREATE INDEX "support_attachments_ticketId_createdAt_idx" ON "support_attachments"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_isRead_idx" ON "support_messages"("ticketId", "isRead");

-- CreateIndex
CREATE INDEX "support_messages_senderUserId_idx" ON "support_messages"("senderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_senderUserId_clientMessageId_key" ON "support_messages"("senderUserId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_conversations_supportTicketId_key" ON "assistant_conversations"("supportTicketId");

-- CreateIndex
CREATE INDEX "assistant_conversations_customerId_updatedAt_idx" ON "assistant_conversations"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "assistant_conversations_status_updatedAt_idx" ON "assistant_conversations"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "assistant_conversations_lastMessageAt_idx" ON "assistant_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "assistant_messages_conversationId_createdAt_idx" ON "assistant_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_messages_conversationId_isRead_idx" ON "assistant_messages"("conversationId", "isRead");

-- CreateIndex
CREATE INDEX "assistant_messages_senderUserId_idx" ON "assistant_messages"("senderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_messages_senderUserId_clientMessageId_key" ON "assistant_messages"("senderUserId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");

-- CreateIndex
CREATE INDEX "feedback_customerId_createdAt_idx" ON "feedback"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_status_createdAt_idx" ON "feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_category_createdAt_idx" ON "feedback"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerProfile_astrologerId_key" ON "MarketplaceSellerProfile"("astrologerId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerProfile_status_idx" ON "MarketplaceSellerProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCategory_slug_key" ON "MarketplaceCategory"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceCategory_isActive_sortOrder_idx" ON "MarketplaceCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProduct_slug_key" ON "MarketplaceProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProduct_sku_key" ON "MarketplaceProduct"("sku");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_astrologerId_idx" ON "MarketplaceProduct"("astrologerId");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_categoryId_idx" ON "MarketplaceProduct"("categoryId");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_status_idx" ON "MarketplaceProduct"("status");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_status_stock_idx" ON "MarketplaceProduct"("status", "stock");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_isFeatured_status_idx" ON "MarketplaceProduct"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "MarketplaceProductImage_productId_sortOrder_idx" ON "MarketplaceProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCampaign_slug_key" ON "MarketplaceCampaign"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceCampaign_status_isActive_idx" ON "MarketplaceCampaign"("status", "isActive");

-- CreateIndex
CREATE INDEX "MarketplaceCampaign_startAt_endAt_idx" ON "MarketplaceCampaign"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "MarketplaceCampaign_priority_idx" ON "MarketplaceCampaign"("priority");

-- CreateIndex
CREATE INDEX "MarketplaceCampaignProduct_productId_idx" ON "MarketplaceCampaignProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCampaignProduct_campaignId_productId_key" ON "MarketplaceCampaignProduct"("campaignId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCart_userId_key" ON "MarketplaceCart"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceCart_updatedAt_idx" ON "MarketplaceCart"("updatedAt");

-- CreateIndex
CREATE INDEX "MarketplaceCartItem_productId_idx" ON "MarketplaceCartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCartItem_cartId_productId_key" ON "MarketplaceCartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "MarketplaceAddress_userId_idx" ON "MarketplaceAddress"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceAddress_userId_isDefault_idx" ON "MarketplaceAddress"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_adminUserId_idx" ON "MarketplaceAdminAction"("adminUserId");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_targetType_targetId_idx" ON "MarketplaceAdminAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_action_idx" ON "MarketplaceAdminAction"("action");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_createdAt_idx" ON "MarketplaceAdminAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_orderNumber_key" ON "MarketplaceOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_razorpayOrderId_key" ON "MarketplaceOrder"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_razorpayPaymentId_key" ON "MarketplaceOrder"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_paymentWebhookEventId_key" ON "MarketplaceOrder"("paymentWebhookEventId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_customerUserId_createdAt_idx" ON "MarketplaceOrder"("customerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_status_createdAt_idx" ON "MarketplaceOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_customerUserId_prepareIdempotencyKey_key" ON "MarketplaceOrder"("customerUserId", "prepareIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentCommand_providerOrderId_key" ON "MarketplacePaymentCommand"("providerOrderId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerOrder_orderId_idx" ON "MarketplaceSellerOrder"("orderId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerOrder_astrologerId_status_idx" ON "MarketplaceSellerOrder"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceSellerOrder_status_createdAt_idx" ON "MarketplaceSellerOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrderItem_sellerOrderId_idx" ON "MarketplaceOrderItem"("sellerOrderId");

-- CreateIndex
CREATE INDEX "MarketplaceOrderItem_productId_idx" ON "MarketplaceOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerEarning_sellerOrderId_key" ON "MarketplaceSellerEarning"("sellerOrderId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerEarning_astrologerId_status_idx" ON "MarketplaceSellerEarning"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceSellerEarning_payoutId_idx" ON "MarketplaceSellerEarning"("payoutId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerEarning_createdAt_idx" ON "MarketplaceSellerEarning"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerPayout_idempotencyKey_key" ON "MarketplaceSellerPayout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceSellerPayout_astrologerId_status_idx" ON "MarketplaceSellerPayout"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceSellerPayout_createdAt_idx" ON "MarketplaceSellerPayout"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_payment_exceptions_razorpayPaymentId_key" ON "marketplace_payment_exceptions"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_payment_exceptions_razorpayRefundId_key" ON "marketplace_payment_exceptions"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "marketplace_payment_exceptions_marketplaceOrderId_idx" ON "marketplace_payment_exceptions"("marketplaceOrderId");

-- CreateIndex
CREATE INDEX "marketplace_payment_exceptions_status_idx" ON "marketplace_payment_exceptions"("status");

-- CreateIndex
CREATE INDEX "marketplace_payment_exceptions_createdAt_idx" ON "marketplace_payment_exceptions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_languages_code_key" ON "app_languages"("code");

-- CreateIndex
CREATE INDEX "app_languages_isActive_sortOrder_idx" ON "app_languages"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "app_translations_languageCode_isActive_idx" ON "app_translations"("languageCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "app_translations_languageCode_key_key" ON "app_translations"("languageCode", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_personas_code_key" ON "ai_astro_personas"("code");

-- CreateIndex
CREATE INDEX "ai_astro_personas_isEnabled_sortOrder_idx" ON "ai_astro_personas"("isEnabled", "sortOrder");

-- CreateIndex
CREATE INDEX "ai_consultant_types_isEnabled_idx" ON "ai_consultant_types"("isEnabled");

-- CreateIndex
CREATE INDEX "ai_consultant_types_sortOrder_idx" ON "ai_consultant_types"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_sessions_clientSessionId_key" ON "ai_astro_sessions"("clientSessionId");

-- CreateIndex
CREATE INDEX "ai_astro_sessions_userId_status_idx" ON "ai_astro_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "ai_astro_sessions_astrologerId_status_idx" ON "ai_astro_sessions"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "ai_astro_sessions_lastHeartbeatAt_idx" ON "ai_astro_sessions"("lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "recharge_packs_isActive_sortOrder_idx" ON "recharge_packs"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_kundli_reports_callSessionId_key" ON "astrologer_kundli_reports"("callSessionId");

-- CreateIndex
CREATE INDEX "astrologer_kundli_reports_customerUserId_status_createdAt_idx" ON "astrologer_kundli_reports"("customerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "astrologer_kundli_reports_astrologerId_status_createdAt_idx" ON "astrologer_kundli_reports"("astrologerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "astrologer_kundli_report_attachments_reportId_createdAt_idx" ON "astrologer_kundli_report_attachments"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "astrology_question_answer_cache_userId_createdAt_idx" ON "astrology_question_answer_cache"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "astrology_question_answer_cache_questionId_idx" ON "astrology_question_answer_cache"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "astrology_question_answer_cache_userId_questionId_kundliHas_key" ON "astrology_question_answer_cache"("userId", "questionId", "kundliHash", "language", "model", "promptVersion", "questionUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologyVideo_youtubeVideoId_key" ON "AstrologyVideo"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "AstrologyVideo_isPublished_sortOrder_idx" ON "AstrologyVideo"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologyVideo_category_isPublished_idx" ON "AstrologyVideo"("category", "isPublished");

-- CreateIndex
CREATE INDEX "AstrologyVideoTranslation_locale_idx" ON "AstrologyVideoTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologyVideoTranslation_videoId_locale_key" ON "AstrologyVideoTranslation"("videoId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologyArticle_slug_key" ON "AstrologyArticle"("slug");

-- CreateIndex
CREATE INDEX "AstrologyArticle_isPublished_sortOrder_idx" ON "AstrologyArticle"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologyArticle_category_isPublished_idx" ON "AstrologyArticle"("category", "isPublished");

-- CreateIndex
CREATE INDEX "AstrologyArticle_status_sortOrder_idx" ON "AstrologyArticle"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologyArticle_publishedAt_idx" ON "AstrologyArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "AstrologyArticleTranslation_locale_idx" ON "AstrologyArticleTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologyArticleTranslation_articleId_locale_key" ON "AstrologyArticleTranslation"("articleId", "locale");

-- CreateIndex
CREATE INDEX "AstrologerFollow_followerId_idx" ON "AstrologerFollow"("followerId");

-- CreateIndex
CREATE INDEX "AstrologerFollow_astrologerId_idx" ON "AstrologerFollow"("astrologerId");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerFollow_followerId_astrologerId_key" ON "AstrologerFollow"("followerId", "astrologerId");

-- CreateIndex
CREATE INDEX "AiAstroFollow_followerId_idx" ON "AiAstroFollow"("followerId");

-- CreateIndex
CREATE INDEX "AiAstroFollow_personaId_idx" ON "AiAstroFollow"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "AiAstroFollow_followerId_personaId_key" ON "AiAstroFollow"("followerId", "personaId");

-- CreateIndex
CREATE INDEX "KundliGenerationConsent_customer_idx" ON "KundliGenerationConsent"("customerUserId", "grantedAt");

-- CreateIndex
CREATE INDEX "KundliGenerationConsent_astrologer_idx" ON "KundliGenerationConsent"("astrologerUserId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KundliGenerationConsentAudit_consentId_action_key" ON "KundliGenerationConsentAudit"("consentId", "action");

-- CreateIndex
CREATE INDEX "KundliGenerationRequest_lease_idx" ON "KundliGenerationRequest"("actorUserId", "status", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KundliGenerationRequest_actorUserId_consultationId_requestK_key" ON "KundliGenerationRequest"("actorUserId", "consultationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "SmartNotificationInsight_generationKey_key" ON "SmartNotificationInsight"("generationKey");

-- CreateIndex
CREATE INDEX "SmartNotificationInsight_owner_idx" ON "SmartNotificationInsight"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmartNotificationInsight_userId_campaignId_key" ON "SmartNotificationInsight"("userId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartNotificationInsight_id_userId_key" ON "SmartNotificationInsight"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartNotificationDelivery_insightId_key" ON "SmartNotificationDelivery"("insightId");

-- CreateIndex
CREATE INDEX "SmartNotificationDelivery_claim_idx" ON "SmartNotificationDelivery"("state", "createdAt");

-- CreateIndex
CREATE INDEX "SmartNotificationDelivery_due_idx" ON "SmartNotificationDelivery"("state", "nextAttemptAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SmartNotificationDelivery_frequency_idx" ON "SmartNotificationDelivery"("userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "SmartNotificationAudit_object_action_idx" ON "SmartNotificationAudit"("objectId", "action");

-- CreateIndex
CREATE INDEX "MarketplaceOrderCase_orderId_status_idx" ON "MarketplaceOrderCase"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrderCase_customerUserId_idempotencyKey_key" ON "MarketplaceOrderCase"("customerUserId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceRefundAttempt_caseId_key" ON "MarketplaceRefundAttempt"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceRefundAttempt_providerRefundId_key" ON "MarketplaceRefundAttempt"("providerRefundId");

-- CreateIndex
CREATE INDEX "MarketplaceRefundAttempt_state_leaseUntil_idx" ON "MarketplaceRefundAttempt"("state", "leaseUntil");

-- CreateIndex
CREATE INDEX "MarketplaceRefundAttemptEvent_attemptId_createdAt_idx" ON "MarketplaceRefundAttemptEvent"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceCaseEvent_caseId_createdAt_idx" ON "MarketplaceCaseEvent"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceFinancialEntry_eventKey_key" ON "MarketplaceFinancialEntry"("eventKey");

-- CreateIndex
CREATE INDEX "MarketplaceFinancialEntry_sellerOrderId_createdAt_idx" ON "MarketplaceFinancialEntry"("sellerOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminModerationAudit_kind_userId_createdAt_idx" ON "AdminModerationAudit"("kind", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminModerationAudit_kind_userId_version_key" ON "AdminModerationAudit"("kind", "userId", "version");

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharing" ADD CONSTRAINT "ConsultationBirthSharing_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharing" ADD CONSTRAINT "ConsultationBirthSharing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharing" ADD CONSTRAINT "ConsultationBirthSharing_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharingAudit" ADD CONSTRAINT "ConsultationBirthSharingAudit_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ConsultationBirthSharingAudit" ADD CONSTRAINT "ConsultationBirthSharingAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Astrologer" ADD CONSTRAINT "Astrologer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerExpertise" ADD CONSTRAINT "AstrologerExpertise_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerExpertise" ADD CONSTRAINT "AstrologerExpertise_expertiseId_fkey" FOREIGN KEY ("expertiseId") REFERENCES "Expertise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_boyId_fkey" FOREIGN KEY ("boyId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_girlId_fkey" FOREIGN KEY ("girlId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KundliData" ADD CONSTRAINT "KundliData_kundliId_fkey" FOREIGN KEY ("kundliId") REFERENCES "Kundli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kundli_saved_records" ADD CONSTRAINT "kundli_saved_records_kundliId_fkey" FOREIGN KEY ("kundliId") REFERENCES "Kundli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kundli_saved_records" ADD CONSTRAINT "kundli_saved_records_createdByAstrologerId_fkey" FOREIGN KEY ("createdByAstrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kundli_saved_records" ADD CONSTRAINT "kundli_saved_records_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_wallet_owner_fkey" FOREIGN KEY ("walletId", "userId") REFERENCES "wallets"("id", "userId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "KundliOrder" ADD CONSTRAINT "KundliOrder_kundliId_fkey" FOREIGN KEY ("kundliId") REFERENCES "Kundli"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KundliOrder" ADD CONSTRAINT "KundliOrder_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KundliOrder" ADD CONSTRAINT "KundliOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationFinancialPolicy" ADD CONSTRAINT "ConsultationFinancialPolicy_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCreationCommand" ADD CONSTRAINT "PaymentCreationCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCreationCommand" ADD CONSTRAINT "PaymentCreationCommand_providerOrderId_fkey" FOREIGN KEY ("providerOrderId") REFERENCES "payment_orders"("razorpayOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminFinanceAction" ADD CONSTRAINT "AdminFinanceAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_earnings" ADD CONSTRAINT "astrologer_earnings_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_earnings" ADD CONSTRAINT "astrologer_earnings_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_earnings" ADD CONSTRAINT "astrologer_earnings_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "astrologer_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_payouts" ADD CONSTRAINT "astrologer_payouts_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_payouts" ADD CONSTRAINT "astrologer_payouts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "astrologer_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_bank_accounts" ADD CONSTRAINT "astrologer_bank_accounts_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_horoscope_history" ADD CONSTRAINT "daily_horoscope_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedHoroscopeReading" ADD CONSTRAINT "PersonalizedHoroscopeReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedHoroscopeReading" ADD CONSTRAINT "PersonalizedHoroscopeReading_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationPreference" ADD CONSTRAINT "HoroscopeNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationOutbox" ADD CONSTRAINT "HoroscopeNotificationOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationOutbox" ADD CONSTRAINT "HoroscopeNotificationOutbox_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeNotificationOutbox" ADD CONSTRAINT "HoroscopeNotificationOutbox_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "PersonalizedHoroscopeReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeSubscriptionControl" ADD CONSTRAINT "HoroscopeSubscriptionControl_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoroscopeSubscriptionAudit" ADD CONSTRAINT "HoroscopeSubscriptionAudit_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerAvailability" ADD CONSTRAINT "AstrologerAvailability_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologyQuestion" ADD CONSTRAINT "AstrologyQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AstrologyQuestionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerQualificationAttempt" ADD CONSTRAINT "AstrologerQualificationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_encryption_devices" ADD CONSTRAINT "chat_encryption_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReceptionistMessage" ADD CONSTRAINT "AiReceptionistMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiReceptionistSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_hostConnectionId_fkey" FOREIGN KEY ("hostConnectionId") REFERENCES "LiveConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMessage" ADD CONSTRAINT "LiveMessage_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMessage" ADD CONSTRAINT "LiveMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveViewer" ADD CONSTRAINT "LiveViewer_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveViewer" ADD CONSTRAINT "LiveViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveConnection" ADD CONSTRAINT "LiveConnection_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveConnection" ADD CONSTRAINT "LiveConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveConnection" ADD CONSTRAINT "LiveConnection_legacyViewerId_fkey" FOREIGN KEY ("legacyViewerId") REFERENCES "LiveViewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_pricing" ADD CONSTRAINT "ai_astro_pricing_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_usages" ADD CONSTRAINT "ai_astro_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_usages" ADD CONSTRAINT "ai_astro_usages_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_conversations" ADD CONSTRAINT "ai_astro_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_conversations" ADD CONSTRAINT "ai_astro_conversations_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_messages" ADD CONSTRAINT "ai_astro_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_astro_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportOperationAudit" ADD CONSTRAINT "SupportOperationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPrivateNote" ADD CONSTRAINT "SupportPrivateNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPrivateNote" ADD CONSTRAINT "SupportPrivateNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportDelivery" ADD CONSTRAINT "SupportDelivery_ticketId_ownerId_fkey" FOREIGN KEY ("ticketId", "ownerId") REFERENCES "support_tickets"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportDelivery" ADD CONSTRAINT "SupportDelivery_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackContext" ADD CONSTRAINT "FeedbackContext_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackContext" ADD CONSTRAINT "FeedbackContext_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEscalation" ADD CONSTRAINT "FeedbackEscalation_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEscalation" ADD CONSTRAINT "FeedbackEscalation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerProfile" ADD CONSTRAINT "MarketplaceSellerProfile_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketplaceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProductImage" ADD CONSTRAINT "MarketplaceProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCampaignProduct" ADD CONSTRAINT "MarketplaceCampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketplaceCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCampaignProduct" ADD CONSTRAINT "MarketplaceCampaignProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCart" ADD CONSTRAINT "MarketplaceCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAddress" ADD CONSTRAINT "MarketplaceAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAdminAction" ADD CONSTRAINT "MarketplaceAdminAction_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCheckoutSnapshot" ADD CONSTRAINT "MarketplaceCheckoutSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCheckoutSnapshot" ADD CONSTRAINT "MarketplaceCheckoutSnapshot_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentCommand" ADD CONSTRAINT "MarketplacePaymentCommand_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceCheckoutSnapshot"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerOrder" ADD CONSTRAINT "MarketplaceSellerOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerOrder" ADD CONSTRAINT "MarketplaceSellerOrder_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "MarketplaceSellerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerEarning" ADD CONSTRAINT "MarketplaceSellerEarning_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "MarketplaceSellerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerEarning" ADD CONSTRAINT "MarketplaceSellerEarning_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerEarning" ADD CONSTRAINT "MarketplaceSellerEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "MarketplaceSellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerPayout" ADD CONSTRAINT "MarketplaceSellerPayout_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_payment_exceptions" ADD CONSTRAINT "marketplace_payment_exceptions_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_kundli_reports" ADD CONSTRAINT "astrologer_kundli_reports_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_kundli_reports" ADD CONSTRAINT "astrologer_kundli_reports_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_kundli_reports" ADD CONSTRAINT "astrologer_kundli_reports_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_kundli_report_attachments" ADD CONSTRAINT "astrologer_kundli_report_attachments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "astrologer_kundli_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrology_question_answer_cache" ADD CONSTRAINT "astrology_question_answer_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrology_question_answer_cache" ADD CONSTRAINT "astrology_question_answer_cache_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AstrologyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologyVideoTranslation" ADD CONSTRAINT "AstrologyVideoTranslation_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "AstrologyVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologyArticleTranslation" ADD CONSTRAINT "AstrologyArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "AstrologyArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerFollow" ADD CONSTRAINT "AstrologerFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AstrologerFollow" ADD CONSTRAINT "AstrologerFollow_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAstroFollow" ADD CONSTRAINT "AiAstroFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAstroFollow" ADD CONSTRAINT "AiAstroFollow_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "ai_astro_personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KundliGenerationConsent" ADD CONSTRAINT "KundliGenerationConsent_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationConsent" ADD CONSTRAINT "KundliGenerationConsent_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationConsent" ADD CONSTRAINT "KundliGenerationConsent_astrologerUserId_fkey" FOREIGN KEY ("astrologerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationConsent" ADD CONSTRAINT "KundliGenerationConsent_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationConsentAudit" ADD CONSTRAINT "KundliGenerationConsentAudit_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "KundliGenerationConsent"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationConsentAudit" ADD CONSTRAINT "KundliGenerationConsentAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationRequest" ADD CONSTRAINT "KundliGenerationRequest_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationRequest" ADD CONSTRAINT "KundliGenerationRequest_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationRequest" ADD CONSTRAINT "KundliGenerationRequest_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "KundliGenerationConsent"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "KundliGenerationRequest" ADD CONSTRAINT "KundliGenerationRequest_savedRecordId_fkey" FOREIGN KEY ("savedRecordId") REFERENCES "kundli_saved_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationConsent" ADD CONSTRAINT "SmartNotificationConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationConsent" ADD CONSTRAINT "SmartNotificationConsent_category_fkey" FOREIGN KEY ("category") REFERENCES "SmartNotificationPolicy"("category") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationCampaign" ADD CONSTRAINT "SmartNotificationCampaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationCampaign" ADD CONSTRAINT "SmartNotificationCampaign_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationCampaign" ADD CONSTRAINT "SmartNotificationCampaign_category_fkey" FOREIGN KEY ("category") REFERENCES "SmartNotificationPolicy"("category") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationInsight" ADD CONSTRAINT "SmartNotificationInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationInsight" ADD CONSTRAINT "SmartNotificationInsight_category_fkey" FOREIGN KEY ("category") REFERENCES "SmartNotificationPolicy"("category") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationInsight" ADD CONSTRAINT "SmartNotificationInsight_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmartNotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationDelivery" ADD CONSTRAINT "SmartNotificationDelivery_insightId_userId_fkey" FOREIGN KEY ("insightId", "userId") REFERENCES "SmartNotificationInsight"("id", "userId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationAudit" ADD CONSTRAINT "SmartNotificationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SmartNotificationOpen" ADD CONSTRAINT "SmartNotificationOpen_insightId_userId_fkey" FOREIGN KEY ("insightId", "userId") REFERENCES "SmartNotificationInsight"("id", "userId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderCase" ADD CONSTRAINT "MarketplaceOrderCase_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceRefundAttempt" ADD CONSTRAINT "MarketplaceRefundAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MarketplaceOrderCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceRefundAttemptEvent" ADD CONSTRAINT "MarketplaceRefundAttemptEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "MarketplaceRefundAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCaseEvent" ADD CONSTRAINT "MarketplaceCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MarketplaceOrderCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCaseEvent" ADD CONSTRAINT "MarketplaceCaseEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceFinancialEntry" ADD CONSTRAINT "MarketplaceFinancialEntry_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "MarketplaceSellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminModerationSubject" ADD CONSTRAINT "AdminModerationSubject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminModerationAudit" ADD CONSTRAINT "AdminModerationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminModerationAudit" ADD CONSTRAINT "AdminModerationAudit_kind_userId_fkey" FOREIGN KEY ("kind", "userId") REFERENCES "AdminModerationSubject"("kind", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
