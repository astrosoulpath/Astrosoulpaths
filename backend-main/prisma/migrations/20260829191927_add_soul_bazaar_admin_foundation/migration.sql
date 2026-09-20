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
CREATE INDEX "MarketplaceAdminAction_adminUserId_idx" ON "MarketplaceAdminAction"("adminUserId");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_targetType_targetId_idx" ON "MarketplaceAdminAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_action_idx" ON "MarketplaceAdminAction"("action");

-- CreateIndex
CREATE INDEX "MarketplaceAdminAction_createdAt_idx" ON "MarketplaceAdminAction"("createdAt");

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
ALTER TABLE "MarketplaceAdminAction" ADD CONSTRAINT "MarketplaceAdminAction_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
