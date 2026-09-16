import { createHmac, timingSafeEqual, randomBytes, randomUUID } from 'crypto';
import {
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  MarketplaceAdminActionType,
  MarketplaceCampaignStatus,
  MarketplaceFulfillmentStatus,
  MarketplaceOrderStatus,
  MarketplaceProductStatus,
  MarketplaceSellerStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { getRazorpayInstance } from '../../config/razorpay.config';
import { AddMarketplaceCartItemDto } from './dto/add-marketplace-cart-item.dto';
import { UpdateMarketplaceCartItemDto } from './dto/update-marketplace-cart-item.dto';
import { CreateMarketplaceAddressDto } from './dto/create-marketplace-address.dto';
import { UpdateMarketplaceAddressDto } from './dto/update-marketplace-address.dto';
import { PrepareMarketplaceOrderDto } from './dto/prepare-marketplace-order.dto';
import { ShipMarketplaceOrderDto } from './dto/ship-marketplace-order.dto';

import { CreateMarketplaceProductDto } from './dto/create-marketplace-product.dto';
import { UpdateMarketplaceProductDto } from './dto/update-marketplace-product.dto';
import { UpsertMarketplaceSellerProfileDto } from './dto/upsert-marketplace-seller-profile.dto';
import { CreateMarketplaceCategoryDto } from './dto/create-marketplace-category.dto';
import { UpdateMarketplaceCategoryDto } from './dto/update-marketplace-category.dto';
import { CreateMarketplaceCampaignDto } from './dto/create-marketplace-campaign.dto';
import { UpdateMarketplaceCampaignDto } from './dto/update-marketplace-campaign.dto';
import { AddMarketplaceCampaignProductDto } from './dto/add-marketplace-campaign-product.dto';
import { VerifyMarketplacePaymentDto } from './dto/verify-marketplace-payment.dto';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async uniqueProductSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const base = this.slugify(name) || 'product';

    let slug = base;
    let suffix = 1;

    while (
      await this.prisma.marketplaceProduct.findFirst({
        where: {
          slug,
          ...(excludeId
            ? {
                id: {
                  not: excludeId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      })
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    return slug;
  }

  private async uniqueCategorySlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const base = this.slugify(name) || 'category';

    let slug = base;
    let suffix = 1;

    while (
      await this.prisma.marketplaceCategory.findFirst({
        where: {
          slug,
          ...(excludeId
            ? {
                id: {
                  not: excludeId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      })
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    return slug;
  }

  private async uniqueCampaignSlug(name: string): Promise<string> {
    const base = this.slugify(name) || 'campaign';

    let slug = base;
    let suffix = 1;

    while (
      await this.prisma.marketplaceCampaign.findUnique({
        where: {
          slug,
        },
        select: {
          id: true,
        },
      })
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    return slug;
  }

  private async resolveUserBySupabaseId(supabaseId: string) {
    const normalized = supabaseId?.trim();

    if (!normalized) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId: normalized,
      },
      include: {
        astrologer: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('Account is blocked');
    }

    return user;
  }

  private async requireSellerAstrologer(
    supabaseId: string,
    requireMarketplaceActive = false,
  ) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user.isAstrologer || !user.astrologer) {
      throw new ForbiddenException('Astrologer profile required');
    }

    if (!user.astrologer.isApproved || !user.astrologer.isVerified) {
      throw new ForbiddenException(
        'Only approved and verified astrologers can use marketplace seller features',
      );
    }

    if (requireMarketplaceActive) {
      const seller = await this.prisma.marketplaceSellerProfile.findUnique({
        where: {
          astrologerId: user.astrologer.id,
        },
      });

      if (!seller || seller.status !== MarketplaceSellerStatus.ACTIVE) {
        throw new ForbiddenException('Marketplace seller access is not active');
      }
    }

    return {
      user,
      astrologer: user.astrologer,
    };
  }

  private async resolveAdminUser(supabaseId: string) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    return user;
  }

  private validateProductPrices(mrp: number, sellingPrice: number) {
    if (sellingPrice > mrp) {
      throw new BadRequestException('Selling price cannot exceed MRP');
    }
  }

  // ==========================================================
  // SELLER
  // ==========================================================

  async getSellerProfile(supabaseId: string) {
    const { astrologer } = await this.requireSellerAstrologer(
      supabaseId,
      false,
    );

    const seller = await this.prisma.marketplaceSellerProfile.findUnique({
      where: {
        astrologerId: astrologer.id,
      },
    });

    return {
      success: true,
      data: seller,
      eligible: true,
    };
  }

  async requestOrUpdateSellerProfile(
    supabaseId: string,
    dto: UpsertMarketplaceSellerProfileDto,
  ) {
    const { astrologer } = await this.requireSellerAstrologer(
      supabaseId,
      false,
    );

    const existing = await this.prisma.marketplaceSellerProfile.findUnique({
      where: {
        astrologerId: astrologer.id,
      },
    });

    if (existing?.status === MarketplaceSellerStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Suspended seller profile cannot be modified',
      );
    }

    const seller = await this.prisma.marketplaceSellerProfile.upsert({
      where: {
        astrologerId: astrologer.id,
      },
      create: {
        astrologerId: astrologer.id,
        status: MarketplaceSellerStatus.PENDING,
        shopDisplayName: dto.shopDisplayName?.trim() || null,
        shopBio: dto.shopBio?.trim() || null,
      },
      update: {
        shopDisplayName:
          dto.shopDisplayName !== undefined
            ? dto.shopDisplayName.trim() || null
            : undefined,
        shopBio:
          dto.shopBio !== undefined ? dto.shopBio.trim() || null : undefined,

        ...(existing?.status === MarketplaceSellerStatus.REJECTED
          ? {
              status: MarketplaceSellerStatus.PENDING,
              rejectionReason: null,
            }
          : {}),
      },
    });

    return {
      success: true,
      data: seller,
    };
  }

  async getSellerProducts(supabaseId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const products = await this.prisma.marketplaceProduct.findMany({
      where: {
        astrologerId: astrologer.id,
      },
      include: {
        category: true,
        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: products,
    };
  }

  async createSellerProduct(
    supabaseId: string,
    dto: CreateMarketplaceProductDto,
  ) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    this.validateProductPrices(dto.mrp, dto.sellingPrice);

    const category = await this.prisma.marketplaceCategory.findFirst({
      where: {
        id: dto.categoryId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new BadRequestException('Active marketplace category not found');
    }

    const sku = dto.sku.trim();

    const duplicateSku = await this.prisma.marketplaceProduct.findUnique({
      where: {
        sku,
      },
      select: {
        id: true,
      },
    });

    if (duplicateSku) {
      throw new BadRequestException('Product SKU already exists');
    }

    const slug = await this.uniqueProductSlug(dto.name);

    const product = await this.prisma.marketplaceProduct.create({
      data: {
        astrologerId: astrologer.id,
        categoryId: category.id,
        name: dto.name.trim(),
        slug,
        sku,
        shortDescription: dto.shortDescription?.trim() || null,
        description: dto.description?.trim() || null,
        currency: 'INR',
        mrp: new Prisma.Decimal(dto.mrp),
        sellingPrice: new Prisma.Decimal(dto.sellingPrice),
        stock: dto.stock,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        shippingCharge: new Prisma.Decimal(dto.shippingCharge ?? 0),
        weightGrams: dto.weightGrams ?? null,
        status: MarketplaceProductStatus.DRAFT,
        isFeatured: false,
      },
      include: {
        category: true,
        images: true,
      },
    });

    return {
      success: true,
      data: product,
    };
  }

  async updateSellerProduct(
    supabaseId: string,
    productId: string,
    dto: UpdateMarketplaceProductDto,
  ) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const existing = await this.prisma.marketplaceProduct.findFirst({
      where: {
        id: productId,
        astrologerId: astrologer.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (
      !(
        existing.status === MarketplaceProductStatus.DRAFT ||
        existing.status === MarketplaceProductStatus.REJECTED
      )
    ) {
      throw new BadRequestException(
        'Only draft or rejected products can be edited',
      );
    }

    const mrp = dto.mrp ?? Number(existing.mrp);

    const sellingPrice = dto.sellingPrice ?? Number(existing.sellingPrice);

    this.validateProductPrices(mrp, sellingPrice);

    if (dto.categoryId) {
      const category = await this.prisma.marketplaceCategory.findFirst({
        where: {
          id: dto.categoryId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        throw new BadRequestException('Active marketplace category not found');
      }
    }

    if (dto.sku) {
      const skuOwner = await this.prisma.marketplaceProduct.findFirst({
        where: {
          sku: dto.sku.trim(),
          id: {
            not: productId,
          },
        },
        select: {
          id: true,
        },
      });

      if (skuOwner) {
        throw new BadRequestException('Product SKU already exists');
      }
    }

    let slug: string | undefined;

    if (dto.name) {
      slug = await this.uniqueProductSlug(dto.name, productId);
    }

    const product = await this.prisma.marketplaceProduct.update({
      where: {
        id: productId,
      },
      data: {
        categoryId: dto.categoryId,
        name: dto.name?.trim(),
        slug,
        sku: dto.sku?.trim(),
        shortDescription:
          dto.shortDescription !== undefined
            ? dto.shortDescription.trim() || null
            : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        mrp: dto.mrp !== undefined ? new Prisma.Decimal(dto.mrp) : undefined,
        sellingPrice:
          dto.sellingPrice !== undefined
            ? new Prisma.Decimal(dto.sellingPrice)
            : undefined,
        stock: dto.stock,
        lowStockThreshold: dto.lowStockThreshold,
        shippingCharge:
          dto.shippingCharge !== undefined
            ? new Prisma.Decimal(dto.shippingCharge)
            : undefined,
        weightGrams: dto.weightGrams,
        rejectionReason: null,
        rejectedAt: null,
      },
      include: {
        category: true,
        images: true,
      },
    });

    return {
      success: true,
      data: product,
    };
  }

  async uploadSellerProductImage(
    supabaseId: string,
    productId: string,
    file: Express.Multer.File,
  ) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    if (!file) {
      throw new BadRequestException('Product image is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, PNG and WEBP product images are allowed',
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Uploaded product image is empty');
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('Product image must be 8 MB or smaller');
    }

    const product = await this.prisma.marketplaceProduct.findFirst({
      where: {
        id: productId,
        astrologerId: astrologer.id,
      },
      include: {
        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (
      product.status !== MarketplaceProductStatus.DRAFT &&
      product.status !== MarketplaceProductStatus.REJECTED
    ) {
      throw new ConflictException(
        'Images can only be changed while product is in draft or rejected state',
      );
    }

    if (product.images.length >= 8) {
      throw new BadRequestException('Maximum 8 images are allowed per product');
    }

    const extension =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';

    const bucket = 'marketplace-products';

    const storagePath =
      `${astrologer.id}/${product.id}/` +
      `${Date.now()}-${randomUUID()}.${extension}`;

    const client = this.supabaseService.getStorageClient();

    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new InternalServerErrorException(
        `Unable to upload product image: ${uploadError.message}`,
      );
    }

    const {
      data: { publicUrl },
    } = client.storage.from(bucket).getPublicUrl(storagePath);

    if (!publicUrl) {
      await client.storage.from(bucket).remove([storagePath]);

      throw new InternalServerErrorException(
        'Unable to generate product image URL',
      );
    }

    try {
      const image = await this.prisma.marketplaceProductImage.create({
        data: {
          productId: product.id,
          imageUrl: publicUrl,
          altText: product.name,
          isPrimary: product.images.length === 0,
          sortOrder: product.images.length,
        },
      });

      const updatedProduct = await this.prisma.marketplaceProduct.findUnique({
        where: {
          id: product.id,
        },
        include: {
          category: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      });

      return {
        success: true,
        message: 'Product image uploaded successfully',
        data: {
          image,
          product: updatedProduct,
        },
      };
    } catch (error) {
      await client.storage.from(bucket).remove([storagePath]);
      throw error;
    }
  }
  async submitSellerProduct(supabaseId: string, productId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const existing = await this.prisma.marketplaceProduct.findFirst({
      where: {
        id: productId,
        astrologerId: astrologer.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (
      !(
        existing.status === MarketplaceProductStatus.DRAFT ||
        existing.status === MarketplaceProductStatus.REJECTED
      )
    ) {
      throw new BadRequestException(
        'Product cannot be submitted in current state',
      );
    }

    if (Number(existing.sellingPrice) > Number(existing.mrp)) {
      throw new BadRequestException('Selling price cannot exceed MRP');
    }

    const imageCount = await this.prisma.marketplaceProductImage.count({
      where: {
        productId: existing.id,
      },
    });

    if (imageCount < 1) {
      throw new BadRequestException(
        'At least one real product image is required before submission',
      );
    }

    const product = await this.prisma.marketplaceProduct.update({
      where: {
        id: existing.id,
      },
      data: {
        status: MarketplaceProductStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        rejectionReason: null,
        rejectedAt: null,
      },
    });

    return {
      success: true,
      data: product,
    };
  }

  // ==========================================================
  // PUBLIC / CUSTOMER READS
  // ==========================================================

  async archiveSellerProduct(supabaseId: string, productId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const existing = await this.prisma.marketplaceProduct.findFirst({
      where: {
        id: productId,
        astrologerId: astrologer.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (
      !(
        existing.status === MarketplaceProductStatus.DRAFT ||
        existing.status === MarketplaceProductStatus.REJECTED
      )
    ) {
      throw new BadRequestException(
        'Only draft or rejected products can be archived by seller',
      );
    }

    const product = await this.prisma.marketplaceProduct.update({
      where: {
        id: existing.id,
      },
      data: {
        status: MarketplaceProductStatus.ARCHIVED,
        isFeatured: false,
      },
    });

    return {
      success: true,
      data: product,
    };
  }

  async getPublicCategories() {
    const categories = await this.prisma.marketplaceCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });

    return {
      success: true,
      data: categories,
    };
  }

  async getPublicProducts(
    search?: string,
    categoryId?: string,
    featured?: boolean,
  ) {
    const normalizedSearch = search?.trim();

    const products = await this.prisma.marketplaceProduct.findMany({
      where: {
        status: MarketplaceProductStatus.ACTIVE,

        stock: {
          gt: 0,
        },

        images: {
          some: {},
        },

        ...(categoryId
          ? {
              categoryId,
            }
          : {}),

        ...(featured !== undefined
          ? {
              isFeatured: featured,
            }
          : {}),

        ...(normalizedSearch
          ? {
              OR: [
                {
                  name: {
                    contains: normalizedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  shortDescription: {
                    contains: normalizedSearch,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),

        category: {
          is: {
            isActive: true,
          },
        },

        astrologer: {
          is: {
            isApproved: true,
            isVerified: true,

            marketplaceSellerProfile: {
              is: {
                status: MarketplaceSellerStatus.ACTIVE,
              },
            },

            user: {
              is: {
                isActive: true,
                isBlocked: false,
              },
            },
          },
        },
      },

      include: {
        category: true,

        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },

        astrologer: {
          select: {
            id: true,
            rating: true,

            user: {
              select: {
                name: true,
                avatarUrl: true,
              },
            },

            marketplaceSellerProfile: {
              select: {
                shopDisplayName: true,
              },
            },
          },
        },
      },

      orderBy: [
        {
          isFeatured: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return {
      success: true,
      data: products,
    };
  }

  async getPublicProductById(id: string) {
    const product = await this.prisma.marketplaceProduct.findFirst({
      where: {
        id,

        status: MarketplaceProductStatus.ACTIVE,

        stock: {
          gt: 0,
        },

        images: {
          some: {},
        },

        category: {
          is: {
            isActive: true,
          },
        },

        astrologer: {
          is: {
            isApproved: true,
            isVerified: true,

            marketplaceSellerProfile: {
              is: {
                status: MarketplaceSellerStatus.ACTIVE,
              },
            },

            user: {
              is: {
                isActive: true,
                isBlocked: false,
              },
            },
          },
        },
      },

      include: {
        category: true,

        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },

        astrologer: {
          select: {
            id: true,
            rating: true,
            totalReviews: true,

            user: {
              select: {
                name: true,
                avatarUrl: true,
              },
            },

            marketplaceSellerProfile: {
              select: {
                shopDisplayName: true,
                shopBio: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    return {
      success: true,
      data: product,
    };
  }

  async getPublicCampaigns() {
    const now = new Date();

    const campaigns = await this.prisma.marketplaceCampaign.findMany({
      where: {
        isActive: true,

        status: MarketplaceCampaignStatus.ACTIVE,

        startAt: {
          lte: now,
        },

        endAt: {
          gte: now,
        },
      },

      include: {
        products: {
          where: {
            product: {
              status: MarketplaceProductStatus.ACTIVE,

              stock: {
                gt: 0,
              },

              category: {
                is: {
                  isActive: true,
                },
              },

              astrologer: {
                is: {
                  isApproved: true,
                  isVerified: true,

                  marketplaceSellerProfile: {
                    is: {
                      status: MarketplaceSellerStatus.ACTIVE,
                    },
                  },

                  user: {
                    is: {
                      isActive: true,
                      isBlocked: false,
                    },
                  },
                },
              },
            },
          },

          include: {
            product: {
              include: {
                images: {
                  orderBy: {
                    sortOrder: 'asc',
                  },
                },
              },
            },
          },
        },
      },

      orderBy: [
        {
          priority: 'desc',
        },
        {
          startAt: 'asc',
        },
      ],
    });

    return {
      success: true,
      data: campaigns,
    };
  }

  // ==========================================================
  // ADMIN
  // ==========================================================

  async adminGetSellers() {
    return {
      success: true,
      data: await this.prisma.marketplaceSellerProfile.findMany({
        include: {
          astrologer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                  isActive: true,
                  isBlocked: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    };
  }

  private async auditAdminAction(
    adminUserId: string,
    action: MarketplaceAdminActionType,
    targetType: string,
    targetId: string,
    reason?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.marketplaceAdminAction.create({
      data: {
        adminUserId,
        action,
        targetType,
        targetId,
        reason: reason?.trim() || null,
        metadata,
      },
    });
  }

  async adminActivateSeller(adminSupabaseId: string, sellerId: string) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const seller = await this.prisma.marketplaceSellerProfile.findUnique({
      where: {
        id: sellerId,
      },
      include: {
        astrologer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Marketplace seller not found');
    }

    if (
      !seller.astrologer.isApproved ||
      !seller.astrologer.isVerified ||
      !seller.astrologer.user.isActive ||
      seller.astrologer.user.isBlocked
    ) {
      throw new BadRequestException(
        'Seller astrologer is not currently eligible',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceSellerProfile.update({
        where: {
          id: seller.id,
        },
        data: {
          status: MarketplaceSellerStatus.ACTIVE,
          activatedAt: new Date(),
          suspendedAt: null,
          suspensionReason: null,
          rejectionReason: null,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.SELLER_ACTIVATED,
          targetType: 'MarketplaceSellerProfile',
          targetId: seller.id,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminSuspendSeller(
    adminSupabaseId: string,
    sellerId: string,
    reason?: string,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const seller = await this.prisma.marketplaceSellerProfile.findUnique({
      where: {
        id: sellerId,
      },
    });

    if (!seller) {
      throw new NotFoundException('Marketplace seller not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceSellerProfile.update({
        where: {
          id: seller.id,
        },
        data: {
          status: MarketplaceSellerStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspensionReason: reason?.trim() || null,
        },
      });

      await tx.marketplaceProduct.updateMany({
        where: {
          astrologerId: seller.astrologerId,

          status: MarketplaceProductStatus.ACTIVE,
        },

        data: {
          status: MarketplaceProductStatus.ARCHIVED,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.SELLER_SUSPENDED,
          targetType: 'MarketplaceSellerProfile',
          targetId: seller.id,
          reason: reason?.trim() || null,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminRejectSeller(
    adminSupabaseId: string,
    sellerId: string,
    reason: string,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const seller = await this.prisma.marketplaceSellerProfile.findUnique({
      where: {
        id: sellerId,
      },
    });

    if (!seller) {
      throw new NotFoundException('Marketplace seller not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceSellerProfile.update({
        where: {
          id: seller.id,
        },
        data: {
          status: MarketplaceSellerStatus.REJECTED,
          rejectionReason: reason.trim(),
          activatedAt: null,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.SELLER_REJECTED,
          targetType: 'MarketplaceSellerProfile',
          targetId: seller.id,
          reason: reason.trim(),
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminCreateCategory(
    adminSupabaseId: string,
    dto: CreateMarketplaceCategoryDto,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const slug = await this.uniqueCategorySlug(dto.name);

    const category = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceCategory.create({
        data: {
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: true,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CATEGORY_CREATED,
          targetType: 'MarketplaceCategory',
          targetId: created.id,
        },
      });

      return created;
    });

    return {
      success: true,
      data: category,
    };
  }

  async adminGetCategories() {
    return {
      success: true,
      data: await this.prisma.marketplaceCategory.findMany({
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
      }),
    };
  }

  async adminUpdateCategory(
    adminSupabaseId: string,
    id: string,
    dto: UpdateMarketplaceCategoryDto,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const existing = await this.prisma.marketplaceCategory.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace category not found');
    }

    const slug = dto.name
      ? await this.uniqueCategorySlug(dto.name, id)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceCategory.update({
        where: {
          id,
        },
        data: {
          name: dto.name?.trim(),
          slug,
          description:
            dto.description !== undefined
              ? dto.description.trim() || null
              : undefined,
          imageUrl:
            dto.imageUrl !== undefined
              ? dto.imageUrl.trim() || null
              : undefined,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action:
            dto.isActive === false
              ? MarketplaceAdminActionType.CATEGORY_DISABLED
              : MarketplaceAdminActionType.CATEGORY_UPDATED,
          targetType: 'MarketplaceCategory',
          targetId: id,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminGetProducts() {
    return {
      success: true,
      data: await this.prisma.marketplaceProduct.findMany({
        include: {
          category: true,
          images: true,
          astrologer: {
            include: {
              user: {
                select: {
                  name: true,
                  phone: true,
                  email: true,
                },
              },
              marketplaceSellerProfile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    };
  }

  async adminApproveProduct(adminSupabaseId: string, productId: string) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const product = await this.prisma.marketplaceProduct.findUnique({
      where: {
        id: productId,
      },
      include: {
        astrologer: {
          include: {
            user: true,
            marketplaceSellerProfile: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (product.status !== MarketplaceProductStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Only pending-review products can be approved',
      );
    }

    if (
      product.astrologer.marketplaceSellerProfile?.status !==
      MarketplaceSellerStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Seller marketplace account must be active',
      );
    }

    if (
      !product.astrologer.isApproved ||
      !product.astrologer.isVerified ||
      !product.astrologer.user.isActive ||
      product.astrologer.user.isBlocked
    ) {
      throw new BadRequestException('Seller astrologer is not eligible');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceProduct.update({
        where: {
          id: product.id,
        },
        data: {
          status:
            product.stock > 0
              ? MarketplaceProductStatus.ACTIVE
              : MarketplaceProductStatus.OUT_OF_STOCK,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.PRODUCT_APPROVED,
          targetType: 'MarketplaceProduct',
          targetId: product.id,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminRejectProduct(
    adminSupabaseId: string,
    productId: string,
    reason: string,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const product = await this.prisma.marketplaceProduct.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceProduct.update({
        where: {
          id: product.id,
        },
        data: {
          status: MarketplaceProductStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: reason.trim(),
          approvedAt: null,
          isFeatured: false,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.PRODUCT_REJECTED,
          targetType: 'MarketplaceProduct',
          targetId: product.id,
          reason: reason.trim(),
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminArchiveProduct(
    adminSupabaseId: string,
    productId: string,
    reason?: string,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const product = await this.prisma.marketplaceProduct.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceProduct.update({
        where: {
          id: product.id,
        },
        data: {
          status: MarketplaceProductStatus.ARCHIVED,
          isFeatured: false,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.PRODUCT_DISABLED,
          targetType: 'MarketplaceProduct',
          targetId: product.id,
          reason: reason?.trim() || null,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminSetProductFeatured(
    adminSupabaseId: string,
    productId: string,
    featured: boolean,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const product = await this.prisma.marketplaceProduct.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (featured && product.status !== MarketplaceProductStatus.ACTIVE) {
      throw new BadRequestException('Only active products can be featured');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceProduct.update({
        where: {
          id: product.id,
        },
        data: {
          isFeatured: featured,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: featured
            ? MarketplaceAdminActionType.PRODUCT_FEATURED
            : MarketplaceAdminActionType.PRODUCT_UNFEATURED,
          targetType: 'MarketplaceProduct',
          targetId: product.id,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminCreateCampaign(
    adminSupabaseId: string,
    dto: CreateMarketplaceCampaignDto,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const startAt = new Date(dto.startAt);

    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('Campaign endAt must be after startAt');
    }

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    const slug = await this.uniqueCampaignSlug(dto.name);

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceCampaign.create({
        data: {
          name: dto.name.trim(),
          slug,
          festivalKey: dto.festivalKey?.trim() || null,
          title: dto.title.trim(),
          subtitle: dto.subtitle?.trim() || null,
          description: dto.description?.trim() || null,
          bannerImageUrl: dto.bannerImageUrl?.trim() || null,
          discountType: dto.discountType,
          discountValue: new Prisma.Decimal(dto.discountValue),
          maxDiscount:
            dto.maxDiscount !== undefined
              ? new Prisma.Decimal(dto.maxDiscount)
              : null,
          startAt,
          endAt,
          priority: dto.priority ?? 0,
          status: MarketplaceCampaignStatus.DRAFT,
          isActive: true,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_CREATED,
          targetType: 'MarketplaceCampaign',
          targetId: created.id,
        },
      });

      return created;
    });

    return {
      success: true,
      data: campaign,
    };
  }

  async adminUpdateCampaign(
    adminSupabaseId: string,
    campaignId: string,
    dto: UpdateMarketplaceCampaignDto,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const existing = await this.prisma.marketplaceCampaign.findUnique({
      where: {
        id: campaignId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace campaign not found');
    }

    const startAt =
      dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;

    const endAt =
      dto.endAt !== undefined ? new Date(dto.endAt) : existing.endAt;

    if (endAt <= startAt) {
      throw new BadRequestException('Campaign endAt must be after startAt');
    }

    const discountType = dto.discountType ?? existing.discountType;

    const discountValue =
      dto.discountValue !== undefined
        ? dto.discountValue
        : Number(existing.discountValue);

    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    let slug;

    if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      slug = await this.uniqueCampaignSlug(dto.name);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceCampaign.update({
        where: {
          id: campaignId,
        },
        data: {
          name: dto.name?.trim(),
          slug,

          festivalKey:
            dto.festivalKey !== undefined
              ? dto.festivalKey.trim() || null
              : undefined,

          title: dto.title?.trim(),

          subtitle:
            dto.subtitle !== undefined
              ? dto.subtitle.trim() || null
              : undefined,

          description:
            dto.description !== undefined
              ? dto.description.trim() || null
              : undefined,

          bannerImageUrl:
            dto.bannerImageUrl !== undefined
              ? dto.bannerImageUrl.trim() || null
              : undefined,

          discountType: dto.discountType,

          discountValue:
            dto.discountValue !== undefined
              ? new Prisma.Decimal(dto.discountValue)
              : undefined,

          maxDiscount:
            dto.maxDiscount !== undefined
              ? dto.maxDiscount === null
                ? null
                : new Prisma.Decimal(dto.maxDiscount)
              : undefined,

          startAt: dto.startAt !== undefined ? startAt : undefined,

          endAt: dto.endAt !== undefined ? endAt : undefined,

          priority: dto.priority,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_UPDATED,
          targetType: 'MarketplaceCampaign',
          targetId: campaignId,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminGetCampaigns() {
    return {
      success: true,
      data: await this.prisma.marketplaceCampaign.findMany({
        include: {
          products: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    };
  }

  async adminAddCampaignProduct(
    adminSupabaseId: string,
    campaignId: string,
    productId: string,
    dto: AddMarketplaceCampaignProductDto,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const campaign = await this.prisma.marketplaceCampaign.findUnique({
      where: {
        id: campaignId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Marketplace campaign not found');
    }

    const product = await this.prisma.marketplaceProduct.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product not found');
    }

    if (product.status !== MarketplaceProductStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active products can be attached to campaigns',
      );
    }

    const link = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceCampaignProduct.upsert({
        where: {
          campaignId_productId: {
            campaignId,
            productId,
          },
        },

        create: {
          campaignId,
          productId,

          overrideDiscountType: dto.overrideDiscountType,

          overrideDiscountValue:
            dto.overrideDiscountValue !== undefined
              ? new Prisma.Decimal(dto.overrideDiscountValue)
              : null,

          overrideMaxDiscount:
            dto.overrideMaxDiscount !== undefined
              ? new Prisma.Decimal(dto.overrideMaxDiscount)
              : null,
        },

        update: {
          overrideDiscountType: dto.overrideDiscountType,

          overrideDiscountValue:
            dto.overrideDiscountValue !== undefined
              ? new Prisma.Decimal(dto.overrideDiscountValue)
              : null,

          overrideMaxDiscount:
            dto.overrideMaxDiscount !== undefined
              ? new Prisma.Decimal(dto.overrideMaxDiscount)
              : null,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_UPDATED,
          targetType: 'MarketplaceCampaign',
          targetId: campaignId,
          metadata: {
            operation: 'PRODUCT_ATTACHED',
            productId,
          },
        },
      });

      return result;
    });

    return {
      success: true,
      data: link,
    };
  }

  async adminRemoveCampaignProduct(
    adminSupabaseId: string,
    campaignId: string,
    productId: string,
  ) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const campaign = await this.prisma.marketplaceCampaign.findUnique({
      where: {
        id: campaignId,
      },
      select: {
        id: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Marketplace campaign not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.marketplaceCampaignProduct.deleteMany({
        where: {
          campaignId,
          productId,
        },
      });

      if (removed.count === 0) {
        throw new NotFoundException('Campaign product link not found');
      }

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_UPDATED,
          targetType: 'MarketplaceCampaign',
          targetId: campaignId,
          metadata: {
            operation: 'PRODUCT_DETACHED',
            productId,
          },
        },
      });
    });

    return {
      success: true,
    };
  }

  async adminActivateCampaign(adminSupabaseId: string, campaignId: string) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const campaign = await this.prisma.marketplaceCampaign.findUnique({
      where: {
        id: campaignId,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Marketplace campaign not found');
    }

    if (campaign.endAt <= new Date()) {
      throw new BadRequestException('Expired campaign cannot be activated');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceCampaign.update({
        where: {
          id: campaignId,
        },
        data: {
          status:
            campaign.startAt > new Date()
              ? MarketplaceCampaignStatus.SCHEDULED
              : MarketplaceCampaignStatus.ACTIVE,
          isActive: true,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_ACTIVATED,
          targetType: 'MarketplaceCampaign',
          targetId: campaignId,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminPauseCampaign(adminSupabaseId: string, campaignId: string) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceCampaign.update({
        where: {
          id: campaignId,
        },
        data: {
          status: MarketplaceCampaignStatus.PAUSED,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_PAUSED,
          targetType: 'MarketplaceCampaign',
          targetId: campaignId,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async adminCancelCampaign(adminSupabaseId: string, campaignId: string) {
    const admin = await this.resolveAdminUser(adminSupabaseId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceCampaign.update({
        where: {
          id: campaignId,
        },
        data: {
          status: MarketplaceCampaignStatus.CANCELLED,
          isActive: false,
        },
      });

      await tx.marketplaceAdminAction.create({
        data: {
          adminUserId: admin.id,
          action: MarketplaceAdminActionType.CAMPAIGN_CANCELLED,
          targetType: 'MarketplaceCampaign',
          targetId: campaignId,
        },
      });

      return result;
    });

    return {
      success: true,
      data: updated,
    };
  }

  private async resolveMarketplaceCustomer(supabaseId: string) {
    const normalizedSupabaseId =
      typeof supabaseId === 'string' ? supabaseId.trim() : '';

    if (!normalizedSupabaseId) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId: normalizedSupabaseId,
      },
      select: {
        id: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!user || !user.isActive || user.isBlocked) {
      throw new ForbiddenException(
        'User is not eligible to use marketplace cart',
      );
    }

    return user;
  }

  private marketplaceCartProductWhere(
    productId: string,
  ): Prisma.MarketplaceProductWhereInput {
    return {
      id: productId,
      status: MarketplaceProductStatus.ACTIVE,
      stock: {
        gt: 0,
      },
      images: {
        some: {},
      },
      category: {
        is: {
          isActive: true,
        },
      },
      astrologer: {
        is: {
          isApproved: true,
          isVerified: true,
          marketplaceSellerProfile: {
            is: {
              status: MarketplaceSellerStatus.ACTIVE,
            },
          },
          user: {
            is: {
              isActive: true,
              isBlocked: false,
            },
          },
        },
      },
    };
  }

  private async buildMarketplaceCartResponse(userId: string) {
    const cart = await this.prisma.marketplaceCart.findUnique({
      where: {
        userId,
      },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            product: {
              include: {
                category: true,
                images: {
                  orderBy: {
                    sortOrder: 'asc',
                  },
                },
                astrologer: {
                  select: {
                    isApproved: true,
                    isVerified: true,
                    user: {
                      select: {
                        isActive: true,
                        isBlocked: true,
                        name: true,
                      },
                    },
                    marketplaceSellerProfile: {
                      select: {
                        status: true,
                        shopDisplayName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return {
        success: true,
        data: {
          id: null,
          items: [],
          subtotal: 0,
          shippingTotal: 0,
          grandTotal: 0,
          currency: 'INR',
        },
      };
    }

    let subtotal = new Prisma.Decimal(0);
    let shippingTotal = new Prisma.Decimal(0);

    const items = cart.items.map((item) => {
      const product = item.product;

      const sellerEligible =
        product.astrologer.isApproved &&
        product.astrologer.isVerified &&
        product.astrologer.user.isActive &&
        !product.astrologer.user.isBlocked &&
        product.astrologer.marketplaceSellerProfile?.status ===
          MarketplaceSellerStatus.ACTIVE;

      const isAvailable =
        product.status === MarketplaceProductStatus.ACTIVE &&
        product.stock > 0 &&
        product.images.length > 0 &&
        product.category.isActive &&
        sellerEligible &&
        item.quantity <= product.stock;

      const lineSubtotal = product.sellingPrice.mul(item.quantity);

      if (isAvailable) {
        subtotal = subtotal.add(lineSubtotal);
        shippingTotal = shippingTotal.add(product.shippingCharge);
      }

      return {
        id: item.id,
        quantity: item.quantity,
        isAvailable,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          currency: product.currency,
          mrp: product.mrp,
          sellingPrice: product.sellingPrice,
          shippingCharge: product.shippingCharge,
          stock: product.stock,
          shortDescription: product.shortDescription,
          category: {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          },
          images: product.images,
          seller: {
            name: product.astrologer.user.name,
            shopDisplayName:
              product.astrologer.marketplaceSellerProfile?.shopDisplayName ??
              null,
          },
        },
        lineSubtotal,
      };
    });

    return {
      success: true,
      data: {
        id: cart.id,
        items,
        subtotal,
        shippingTotal,
        grandTotal: subtotal.add(shippingTotal),
        currency: 'INR',
      },
    };
  }

  async getCustomerCart(supabaseId: string) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    return this.buildMarketplaceCartResponse(user.id);
  }

  async addCustomerCartItem(
    supabaseId: string,
    dto: AddMarketplaceCartItemDto,
  ) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const product = await this.prisma.marketplaceProduct.findFirst({
      where: this.marketplaceCartProductWhere(dto.productId),
      select: {
        id: true,
        stock: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Marketplace product is unavailable');
    }

    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.marketplaceCart.upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
        },
        update: {},
        select: {
          id: true,
        },
      });

      const existing = await tx.marketplaceCartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: product.id,
          },
        },
      });

      const resultingQuantity = (existing?.quantity ?? 0) + dto.quantity;

      if (resultingQuantity > product.stock) {
        throw new BadRequestException(
          `Only ${product.stock} item(s) available in stock`,
        );
      }

      await tx.marketplaceCartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: product.id,
          },
        },
        create: {
          cartId: cart.id,
          productId: product.id,
          quantity: dto.quantity,
        },
        update: {
          quantity: resultingQuantity,
        },
      });
    });

    return this.buildMarketplaceCartResponse(user.id);
  }

  async updateCustomerCartItem(
    supabaseId: string,
    itemId: string,
    dto: UpdateMarketplaceCartItemDto,
  ) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const item = await this.prisma.marketplaceCartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          is: {
            userId: user.id,
          },
        },
      },
      include: {
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Marketplace cart item not found');
    }

    const eligibleProduct = await this.prisma.marketplaceProduct.findFirst({
      where: this.marketplaceCartProductWhere(item.productId),
      select: {
        id: true,
        stock: true,
      },
    });

    if (!eligibleProduct) {
      throw new BadRequestException(
        'Marketplace product is no longer available',
      );
    }

    if (dto.quantity > eligibleProduct.stock) {
      throw new BadRequestException(
        `Only ${eligibleProduct.stock} item(s) available in stock`,
      );
    }

    await this.prisma.marketplaceCartItem.update({
      where: {
        id: item.id,
      },
      data: {
        quantity: dto.quantity,
      },
    });

    return this.buildMarketplaceCartResponse(user.id);
  }

  async removeCustomerCartItem(supabaseId: string, itemId: string) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const item = await this.prisma.marketplaceCartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          is: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Marketplace cart item not found');
    }

    await this.prisma.marketplaceCartItem.delete({
      where: {
        id: item.id,
      },
    });

    return this.buildMarketplaceCartResponse(user.id);
  }

  async getCustomerAddresses(supabaseId: string) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const addresses = await this.prisma.marketplaceAddress.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          updatedAt: 'desc',
        },
      ],
    });

    return {
      success: true,
      data: addresses,
    };
  }

  async createCustomerAddress(
    supabaseId: string,
    dto: CreateMarketplaceAddressDto,
  ) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const address = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.marketplaceAddress.count({
        where: {
          userId: user.id,
        },
      });

      const makeDefault = existingCount === 0 || dto.isDefault === true;

      if (makeDefault) {
        await tx.marketplaceAddress.updateMany({
          where: {
            userId: user.id,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.marketplaceAddress.create({
        data: {
          userId: user.id,
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          addressLine1: dto.addressLine1.trim(),
          addressLine2: dto.addressLine2?.trim() || null,
          landmark: dto.landmark?.trim() || null,
          city: dto.city.trim(),
          state: dto.state.trim(),
          postalCode: dto.postalCode.trim(),
          country: dto.country.trim(),
          countryCode: dto.countryCode?.trim() || null,
          isDefault: makeDefault,
        },
      });
    });

    return {
      success: true,
      data: address,
    };
  }

  async updateCustomerAddress(
    supabaseId: string,
    addressId: string,
    dto: UpdateMarketplaceAddressDto,
  ) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const existing = await this.prisma.marketplaceAddress.findFirst({
      where: {
        id: addressId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace address not found');
    }

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.marketplaceAddress.updateMany({
          where: {
            userId: user.id,
            id: {
              not: existing.id,
            },
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      const nextIsDefault =
        existing.isDefault && dto.isDefault === false
          ? true
          : (dto.isDefault ?? existing.isDefault);

      return tx.marketplaceAddress.update({
        where: {
          id: existing.id,
        },
        data: {
          ...(dto.fullName !== undefined
            ? { fullName: dto.fullName.trim() }
            : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
          ...(dto.addressLine1 !== undefined
            ? { addressLine1: dto.addressLine1.trim() }
            : {}),
          ...(dto.addressLine2 !== undefined
            ? { addressLine2: dto.addressLine2.trim() || null }
            : {}),
          ...(dto.landmark !== undefined
            ? { landmark: dto.landmark.trim() || null }
            : {}),
          ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
          ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
          ...(dto.postalCode !== undefined
            ? { postalCode: dto.postalCode.trim() }
            : {}),
          ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
          ...(dto.countryCode !== undefined
            ? { countryCode: dto.countryCode.trim() || null }
            : {}),
          isDefault: nextIsDefault,
        },
      });
    });

    return {
      success: true,
      data: address,
    };
  }

  async setCustomerDefaultAddress(supabaseId: string, addressId: string) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const existing = await this.prisma.marketplaceAddress.findFirst({
      where: {
        id: addressId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace address not found');
    }

    const address = await this.prisma.$transaction(async (tx) => {
      await tx.marketplaceAddress.updateMany({
        where: {
          userId: user.id,
          id: {
            not: existing.id,
          },
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      return tx.marketplaceAddress.update({
        where: {
          id: existing.id,
        },
        data: {
          isDefault: true,
        },
      });
    });

    return {
      success: true,
      data: address,
    };
  }

  async deleteCustomerAddress(supabaseId: string, addressId: string) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const existing = await this.prisma.marketplaceAddress.findFirst({
      where: {
        id: addressId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Marketplace address not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.marketplaceAddress.delete({
        where: {
          id: existing.id,
        },
      });

      if (existing.isDefault) {
        const replacement = await tx.marketplaceAddress.findFirst({
          where: {
            userId: user.id,
          },
          orderBy: [
            {
              updatedAt: 'desc',
            },
            {
              createdAt: 'desc',
            },
          ],
          select: {
            id: true,
          },
        });

        if (replacement) {
          await tx.marketplaceAddress.update({
            where: {
              id: replacement.id,
            },
            data: {
              isDefault: true,
            },
          });
        }
      }
    });

    return this.getCustomerAddresses(supabaseId);
  }

  private resolveMarketplaceExpectedProviderPaymentSnapshot(order: {
    currency: string;
    grandTotal: Prisma.Decimal;
    paymentCurrency: string | null;
    razorpayAmountSubunits: Prisma.Decimal | null;
  }): {
    currency: string;
    amountSubunits: number;
    legacyFallback: boolean;
  } {
    const baseCurrency = order.currency.trim().toUpperCase();

    const snapshotCurrency =
      order.paymentCurrency?.trim().toUpperCase() || null;

    const hasSnapshotAmount = order.razorpayAmountSubunits !== null;

    /*
     * A payment snapshot must be complete or absent.
     * Partial snapshot data is treated as corrupted state.
     */
    if ((snapshotCurrency === null) !== !hasSnapshotAmount) {
      throw new ConflictException('Marketplace payment snapshot is incomplete');
    }

    if (snapshotCurrency && order.razorpayAmountSubunits) {
      const snapshotAmount = order.razorpayAmountSubunits.toNumber();

      if (!Number.isSafeInteger(snapshotAmount) || snapshotAmount <= 0) {
        throw new ConflictException(
          'Marketplace Razorpay amount snapshot is invalid',
        );
      }

      return {
        currency: snapshotCurrency,
        amountSubunits: snapshotAmount,
        legacyFallback: false,
      };
    }

    /*
     * Legacy orders created before payment-FX snapshots existed.
     * Historical marketplace checkout supported INR only.
     */
    if (baseCurrency !== 'INR') {
      throw new ConflictException(
        'Legacy marketplace payment currency is unsupported',
      );
    }

    const legacyAmountSubunits = this.marketplaceAmountToSubunits(
      order.grandTotal.toNumber(),
      baseCurrency,
    );

    return {
      currency: baseCurrency,
      amountSubunits: legacyAmountSubunits,
      legacyFallback: true,
    };
  }
  async findMarketplaceOrderForRazorpayWebhook(
    razorpayOrderId: string,
  ): Promise<{
    id: string;
    orderNumber: string;
    status: MarketplaceOrderStatus;
    currency: string;
    grandTotal: Prisma.Decimal;
    paymentCurrency: string | null;
    razorpayAmountSubunits: Prisma.Decimal | null;
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    paymentVerifiedAt: Date | null;
    paymentWebhookEventId: string | null;
  } | null> {
    const normalizedRazorpayOrderId = razorpayOrderId.trim();

    if (!normalizedRazorpayOrderId) {
      return null;
    }

    const order = await this.prisma.marketplaceOrder.findUnique({
      where: {
        razorpayOrderId: normalizedRazorpayOrderId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currency: true,
        grandTotal: true,
        paymentCurrency: true,
        razorpayAmountSubunits: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        paymentVerifiedAt: true,
        paymentWebhookEventId: true,
      },
    });

    if (!order?.razorpayOrderId) {
      return null;
    }

    return {
      ...order,
      razorpayOrderId: order.razorpayOrderId,
    };
  }
  async recordMarketplaceCapturedPaymentException(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amount: number;
    currency: string;
    reason: string;
  }) {
    const razorpayOrderId = input.razorpayOrderId.trim();
    const razorpayPaymentId = input.razorpayPaymentId.trim();
    const currency = input.currency.trim().toUpperCase();
    const reason = input.reason.trim();

    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      currency !== 'INR' ||
      !reason
    ) {
      throw new BadRequestException(
        'Invalid marketplace captured-payment compensation data',
      );
    }

    const marketplaceOrder =
      await this.findMarketplaceOrderForRazorpayWebhook(razorpayOrderId);

    if (!marketplaceOrder) {
      throw new NotFoundException('Marketplace order not found');
    }

    const expectedAmount = new Prisma.Decimal(marketplaceOrder.grandTotal)
      .mul(100)
      .toDecimalPlaces(0);

    if (
      expectedAmount.lessThanOrEqualTo(0) ||
      !expectedAmount.isInteger() ||
      expectedAmount.toNumber() !== input.amount
    ) {
      throw new ConflictException(
        'Marketplace compensation payment amount does not match order total',
      );
    }

    if (marketplaceOrder.currency.trim().toUpperCase() !== currency) {
      throw new ConflictException(
        'Marketplace compensation payment currency does not match order',
      );
    }

    /*
     * razorpayPaymentId is unique, making webhook retries idempotent.
     *
     * Do not update an existing row here. In particular, a future REFUNDED
     * record must never be moved back to REFUND_REQUIRED by a duplicate
     * webhook.
     */
    const existing = await this.prisma.marketplacePaymentException.findUnique({
      where: {
        razorpayPaymentId,
      },
    });

    if (existing) {
      return {
        paymentExceptionId: existing.id,
        status: existing.status,
        duplicate: true,
      };
    }

    try {
      const created = await this.prisma.marketplacePaymentException.create({
        data: {
          marketplaceOrderId: marketplaceOrder.id,
          razorpayOrderId,
          razorpayPaymentId,
          amount: input.amount,
          currency,
          reason,
          status: 'REFUND_REQUIRED',
        },
      });

      return {
        paymentExceptionId: created.id,
        status: created.status,
        duplicate: false,
      };
    } catch (error) {
      /*
       * Concurrent duplicate webhook:
       * unique razorpayPaymentId may have been inserted after the first read.
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent =
          await this.prisma.marketplacePaymentException.findUnique({
            where: {
              razorpayPaymentId,
            },
          });

        if (concurrent) {
          return {
            paymentExceptionId: concurrent.id,
            status: concurrent.status,
            duplicate: true,
          };
        }
      }

      throw error;
    }
  }
  async finalizeMarketplaceRazorpayWebhook(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amount: number;
    currency: string;
    status: string;
  }) {
    const razorpayOrderId = input.razorpayOrderId.trim();
    const razorpayPaymentId = input.razorpayPaymentId.trim();
    const currency = input.currency.trim().toUpperCase();
    const paymentStatus = input.status.trim().toLowerCase();

    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new BadRequestException(
        'Marketplace webhook payment reference is incomplete',
      );
    }

    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException(
        'Marketplace webhook payment amount is invalid',
      );
    }

    if (currency !== 'INR') {
      throw new BadRequestException(
        'Marketplace webhook payment currency does not match',
      );
    }

    if (paymentStatus !== 'captured') {
      throw new ConflictException(
        'Marketplace webhook payment is not captured',
      );
    }

    const marketplaceOrder =
      await this.findMarketplaceOrderForRazorpayWebhook(razorpayOrderId);

    if (!marketplaceOrder) {
      return null;
    }

    /*
     * Webhook amount/currency must match the exact payment snapshot
     * frozen when the Razorpay provider order was created.
     */
    const expectedProviderPayment =
      this.resolveMarketplaceExpectedProviderPaymentSnapshot(marketplaceOrder);

    const normalizedWebhookCurrency = input.currency.trim().toUpperCase();

    if (
      !normalizedWebhookCurrency ||
      normalizedWebhookCurrency !== expectedProviderPayment.currency
    ) {
      throw new BadRequestException(
        'Marketplace webhook payment currency does not match order',
      );
    }

    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      input.amount !== expectedProviderPayment.amountSubunits
    ) {
      throw new BadRequestException(
        'Marketplace webhook payment amount does not match order',
      );
    }
    const finalized = await this.prisma.$transaction(
      async (tx) => {
        const lockedOrder = await tx.marketplaceOrder.findUnique({
          where: {
            id: marketplaceOrder.id,
          },
          select: {
            id: true,
            orderNumber: true,
            customerUserId: true,
            status: true,
            razorpayOrderId: true,
            razorpayPaymentId: true,
            paymentVerifiedAt: true,
            sellerOrders: {
              select: {
                items: {
                  select: {
                    productId: true,
                    quantity: true,
                  },
                },
              },
            },
          },
        });

        if (!lockedOrder) {
          throw new NotFoundException('Marketplace order not found');
        }

        if (
          lockedOrder.status === MarketplaceOrderStatus.CONFIRMED &&
          lockedOrder.razorpayOrderId === razorpayOrderId &&
          lockedOrder.razorpayPaymentId === razorpayPaymentId &&
          lockedOrder.paymentVerifiedAt
        ) {
          return {
            orderNumber: lockedOrder.orderNumber,
            alreadyConfirmed: true,
            earningCreatedCount: 0,
            removedCartItems: 0,
          };
        }

        if (lockedOrder.status !== MarketplaceOrderStatus.PENDING_PAYMENT) {
          throw new ConflictException(
            'Marketplace order payment state changed',
          );
        }

        if (lockedOrder.razorpayOrderId !== razorpayOrderId) {
          throw new ConflictException('Marketplace Razorpay order changed');
        }

        const purchasedQuantities = new Map<string, number>();

        for (const sellerOrder of lockedOrder.sellerOrders) {
          for (const item of sellerOrder.items) {
            if (!item.productId) {
              throw new ConflictException(
                'Marketplace order contains an unavailable product reference',
              );
            }

            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
              throw new ConflictException(
                'Marketplace order contains an invalid product quantity',
              );
            }

            purchasedQuantities.set(
              item.productId,
              (purchasedQuantities.get(item.productId) ?? 0) + item.quantity,
            );
          }
        }

        if (purchasedQuantities.size === 0) {
          throw new ConflictException(
            'Marketplace order contains no purchasable items',
          );
        }

        for (const [productId, quantity] of purchasedQuantities) {
          const stockResult = await tx.marketplaceProduct.updateMany({
            where: {
              id: productId,
              status: MarketplaceProductStatus.ACTIVE,
              stock: {
                gte: quantity,
              },
            },
            data: {
              stock: {
                decrement: quantity,
              },
            },
          });

          if (stockResult.count !== 1) {
            throw new ConflictException(
              'One or more marketplace products are unavailable or out of stock',
            );
          }
        }

        const now = new Date();

        const confirmation = await tx.marketplaceOrder.updateMany({
          where: {
            id: lockedOrder.id,
            status: MarketplaceOrderStatus.PENDING_PAYMENT,
            razorpayOrderId,
            razorpayPaymentId: null,
            paymentVerifiedAt: null,
          },
          data: {
            status: MarketplaceOrderStatus.CONFIRMED,
            razorpayPaymentId,
            paymentVerifiedAt: now,
            confirmedAt: now,
          },
        });

        if (confirmation.count !== 1) {
          throw new ConflictException(
            'Marketplace payment was already finalized or changed concurrently',
          );
        }

        const earningResult =
          await this.createMarketplaceEarningsAfterVerifiedPayment(
            tx,
            lockedOrder.id,
          );

        let removedCartItems = 0;

        if (lockedOrder.customerUserId) {
          const cart = await tx.marketplaceCart.findUnique({
            where: {
              userId: lockedOrder.customerUserId,
            },
            select: {
              id: true,
            },
          });

          if (cart) {
            const cartDelete = await tx.marketplaceCartItem.deleteMany({
              where: {
                cartId: cart.id,
                productId: {
                  in: Array.from(purchasedQuantities.keys()),
                },
              },
            });

            removedCartItems = cartDelete.count;
          }
        }

        return {
          orderNumber: lockedOrder.orderNumber,
          alreadyConfirmed: false,
          earningCreatedCount: earningResult.createdCount,
          removedCartItems,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      status: finalized.alreadyConfirmed
        ? ('duplicate' as const)
        : ('success' as const),
      marketplaceOrderId: marketplaceOrder.id,
      orderNumber: finalized.orderNumber,
      razorpayOrderId,
      razorpayPaymentId,
      orderConfirmed: true,
      alreadyConfirmed: finalized.alreadyConfirmed,
      earningCreatedCount: finalized.earningCreatedCount ?? 0,
      removedCartItems: finalized.removedCartItems ?? 0,
    };
  }
  isMarketplaceRefundRequiredFinalizationError(error: unknown): boolean {
    if (!(error instanceof ConflictException)) {
      return false;
    }

    const refundRequiredMessages = new Set([
      'Marketplace order contains an unavailable product reference',
      'Marketplace order contains an invalid product quantity',
      'Marketplace order contains no purchasable items',
      'One or more marketplace products are unavailable or out of stock',
    ]);

    return refundRequiredMessages.has(error.message);
  }
  async verifyMarketplaceRazorpayPayment(
    supabaseId: string,
    orderId: string,
    dto: VerifyMarketplacePaymentDto,
  ) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const razorpayOrderId = dto.razorpayOrderId.trim();
    const razorpayPaymentId = dto.razorpayPaymentId.trim();
    const razorpaySignature = dto.razorpaySignature.trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new BadRequestException(
        'Razorpay payment verification data is incomplete',
      );
    }

    const marketplaceOrder = await this.prisma.marketplaceOrder.findFirst({
      where: {
        id: orderId,
        customerUserId: user.id,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        paymentVerifiedAt: true,
      },
    });

    if (!marketplaceOrder) {
      throw new NotFoundException('Marketplace order not found');
    }

    /*
     * Idempotent retry:
     * if this exact provider payment already confirmed the order,
     * return success without touching stock/cart/earnings again.
     */
    if (
      marketplaceOrder.status === MarketplaceOrderStatus.CONFIRMED &&
      marketplaceOrder.razorpayOrderId === razorpayOrderId &&
      marketplaceOrder.razorpayPaymentId === razorpayPaymentId &&
      marketplaceOrder.paymentVerifiedAt
    ) {
      return {
        success: true,
        message: 'Marketplace payment already verified',
        data: {
          marketplaceOrderId: marketplaceOrder.id,
          orderNumber: marketplaceOrder.orderNumber,
          razorpayOrderId,
          razorpayPaymentId,
          signatureVerified: true,
          orderConfirmed: true,
          alreadyConfirmed: true,
        },
      };
    }

    if (marketplaceOrder.status !== MarketplaceOrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Marketplace order is not awaiting payment');
    }

    if (!marketplaceOrder.razorpayOrderId) {
      throw new ConflictException(
        'Marketplace Razorpay order has not been created',
      );
    }

    if (marketplaceOrder.razorpayOrderId !== razorpayOrderId) {
      throw new BadRequestException(
        'Razorpay order does not match marketplace order',
      );
    }

    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!razorpaySecret) {
      throw new InternalServerErrorException(
        'Razorpay payment verification configuration is unavailable',
      );
    }

    const expectedSignature = createHmac('sha256', razorpaySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (!/^[a-f0-9]{64}$/i.test(razorpaySignature)) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    const receivedBuffer = Buffer.from(razorpaySignature.toLowerCase(), 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    /*
     * Provider-side verification.
     *
     * Checkout HMAC proves the checkout response was signed, but before
     * stock/order/cart/earning mutation we also reconcile the payment
     * against Razorpay itself.
     */
    let razorpayPayments: any[];

    try {
      const paymentResponse = (await getRazorpayInstance().orders.fetchPayments(
        razorpayOrderId,
      )) as any;

      razorpayPayments = Array.isArray(paymentResponse)
        ? paymentResponse
        : Array.isArray(paymentResponse?.items)
          ? paymentResponse.items
          : [];
    } catch {
      throw new BadGatewayException(
        'Unable to fetch marketplace payment status from Razorpay',
      );
    }

    const providerPayment = razorpayPayments.find(
      (payment: any) => payment?.id === razorpayPaymentId,
    );

    if (!providerPayment) {
      throw new BadRequestException(
        'Razorpay payment does not belong to this marketplace order',
      );
    }

    if (providerPayment.order_id !== razorpayOrderId) {
      throw new BadRequestException(
        'Razorpay payment order reference does not match',
      );
    }

    if (
      typeof providerPayment.amount !== 'number' ||
      !Number.isSafeInteger(providerPayment.amount)
    ) {
      throw new BadRequestException('Razorpay payment amount is invalid');
    }

    /*
     * Re-read the exact immutable provider-payment snapshot.
     * Client amount/currency are never trusted.
     */
    const paymentSnapshot = await this.prisma.marketplaceOrder.findUnique({
      where: {
        id: marketplaceOrder.id,
      },
      select: {
        currency: true,
        grandTotal: true,
        paymentCurrency: true,
        razorpayAmountSubunits: true,
        razorpayOrderId: true,
      },
    });

    if (
      !paymentSnapshot ||
      paymentSnapshot.razorpayOrderId !== razorpayOrderId
    ) {
      throw new ConflictException('Marketplace Razorpay order changed');
    }

    const expectedProviderPayment =
      this.resolveMarketplaceExpectedProviderPaymentSnapshot(paymentSnapshot);

    if (
      typeof providerPayment.currency !== 'string' ||
      providerPayment.currency.trim().toUpperCase() !==
        expectedProviderPayment.currency
    ) {
      throw new BadRequestException(
        'Razorpay payment currency does not match marketplace order',
      );
    }

    /*
     * Only captured funds may finalize a physical marketplace order.
     */
    if (providerPayment.status !== 'captured') {
      throw new ConflictException(
        'Marketplace Razorpay payment is not captured',
      );
    }

    if (providerPayment.amount !== expectedProviderPayment.amountSubunits) {
      throw new BadRequestException(
        'Razorpay payment amount does not match marketplace order',
      );
    }
    let finalized;

    try {
      finalized = await this.prisma.$transaction(
        async (tx) => {
          /*
           * Re-read inside the SERIALIZABLE transaction.
           * This is the authoritative state used for mutation.
           */
          const lockedOrder = await tx.marketplaceOrder.findFirst({
            where: {
              id: orderId,
              customerUserId: user.id,
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              razorpayOrderId: true,
              razorpayPaymentId: true,
              paymentVerifiedAt: true,
              sellerOrders: {
                select: {
                  items: {
                    select: {
                      productId: true,
                      quantity: true,
                    },
                  },
                },
              },
            },
          });

          if (!lockedOrder) {
            throw new NotFoundException('Marketplace order not found');
          }

          /*
           * Concurrent/idempotent retry protection.
           */
          if (
            lockedOrder.status === MarketplaceOrderStatus.CONFIRMED &&
            lockedOrder.razorpayOrderId === razorpayOrderId &&
            lockedOrder.razorpayPaymentId === razorpayPaymentId &&
            lockedOrder.paymentVerifiedAt
          ) {
            return {
              orderNumber: lockedOrder.orderNumber,
              alreadyConfirmed: true,
            };
          }

          if (lockedOrder.status !== MarketplaceOrderStatus.PENDING_PAYMENT) {
            throw new ConflictException(
              'Marketplace order payment state changed',
            );
          }

          if (lockedOrder.razorpayOrderId !== razorpayOrderId) {
            throw new ConflictException('Marketplace Razorpay order changed');
          }

          const purchasedQuantities = new Map<string, number>();

          for (const sellerOrder of lockedOrder.sellerOrders) {
            for (const item of sellerOrder.items) {
              if (!item.productId) {
                throw new ConflictException(
                  'Marketplace order contains an unavailable product reference',
                );
              }

              if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                throw new ConflictException(
                  'Marketplace order contains an invalid product quantity',
                );
              }

              purchasedQuantities.set(
                item.productId,
                (purchasedQuantities.get(item.productId) ?? 0) + item.quantity,
              );
            }
          }

          if (purchasedQuantities.size === 0) {
            throw new ConflictException(
              'Marketplace order contains no purchasable items',
            );
          }

          /*
           * Conditional stock decrement.
           *
           * updateMany ensures stock can never go below zero.
           * Any failure throws, causing the entire transaction to roll back.
           */
          for (const [productId, quantity] of purchasedQuantities) {
            const stockResult = await tx.marketplaceProduct.updateMany({
              where: {
                id: productId,
                status: MarketplaceProductStatus.ACTIVE,
                stock: {
                  gte: quantity,
                },
              },
              data: {
                stock: {
                  decrement: quantity,
                },
              },
            });

            if (stockResult.count !== 1) {
              throw new ConflictException(
                'One or more marketplace products are unavailable or out of stock',
              );
            }
          }

          const now = new Date();

          /*
           * CAS prevents two verification requests from confirming
           * the same PENDING_PAYMENT order.
           */
          const confirmation = await tx.marketplaceOrder.updateMany({
            where: {
              id: lockedOrder.id,
              customerUserId: user.id,
              status: MarketplaceOrderStatus.PENDING_PAYMENT,
              razorpayOrderId,
              razorpayPaymentId: null,
              paymentVerifiedAt: null,
            },
            data: {
              status: MarketplaceOrderStatus.CONFIRMED,
              razorpayPaymentId,
              razorpaySignature,
              paymentVerifiedAt: now,
              confirmedAt: now,
            },
          });

          if (confirmation.count !== 1) {
            throw new ConflictException(
              'Marketplace payment was already finalized or changed concurrently',
            );
          }

          /*
           * Existing helper snapshots seller/platform earnings.
           * Because order is now CONFIRMED, its internal order gate passes.
           * sellerOrderId uniqueness protects duplicate earnings.
           */
          const earningResult =
            await this.createMarketplaceEarningsAfterVerifiedPayment(
              tx,
              lockedOrder.id,
            );

          /*
           * Clear ONLY purchased products from this customer's cart.
           * Do not delete unrelated products added after order preparation.
           */
          const cart = await tx.marketplaceCart.findUnique({
            where: {
              userId: user.id,
            },
            select: {
              id: true,
            },
          });

          let removedCartItems = 0;

          if (cart) {
            const cartDelete = await tx.marketplaceCartItem.deleteMany({
              where: {
                cartId: cart.id,
                productId: {
                  in: Array.from(purchasedQuantities.keys()),
                },
              },
            });

            removedCartItems = cartDelete.count;
          }

          return {
            orderNumber: lockedOrder.orderNumber,
            alreadyConfirmed: false,
            earningCreatedCount: earningResult.createdCount,
            removedCartItems,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      /*
       * Only deterministic business conflicts that make fulfillment
       * impossible may become REFUND_REQUIRED.
       *
       * Unknown/transient/internal failures are rethrown without creating
       * refund state so retries can safely recover.
       */
      if (this.isMarketplaceRefundRequiredFinalizationError(error)) {
        const compensationReason =
          error instanceof Error
            ? error.message
            : 'Marketplace captured payment requires compensation';

        // checkout.marketplace_compensation_required
        await this.recordMarketplaceCapturedPaymentException({
          razorpayOrderId,
          razorpayPaymentId,
          amount: providerPayment.amount,
          currency: providerPayment.currency,
          reason: compensationReason,
        });
      }

      throw error;
    }

    return {
      success: true,
      message: finalized.alreadyConfirmed
        ? 'Marketplace payment already verified'
        : 'Marketplace payment verified and order confirmed',
      data: {
        marketplaceOrderId: marketplaceOrder.id,
        orderNumber: finalized.orderNumber,
        razorpayOrderId,
        razorpayPaymentId,
        signatureVerified: true,
        orderConfirmed: true,
        alreadyConfirmed: finalized.alreadyConfirmed,
        earningCreatedCount: finalized.earningCreatedCount ?? 0,
        removedCartItems: finalized.removedCartItems ?? 0,
      },
    };
  }
  private normalizeMarketplacePaymentCountryCode(
    countryCode: string | null | undefined,
  ): string {
    return (countryCode ?? '').trim().toUpperCase();
  }

  private resolveMarketplacePaymentCurrency(
    countryCode: string | null | undefined,
  ): string {
    const normalizedCountryCode =
      this.normalizeMarketplacePaymentCountryCode(countryCode);

    if (!normalizedCountryCode) {
      return 'INR';
    }

    if (normalizedCountryCode === 'IN') {
      return 'INR';
    }

    if (normalizedCountryCode === 'US') {
      return 'USD';
    }

    if (normalizedCountryCode === 'GB') {
      return 'GBP';
    }

    const euroCountries = new Set([
      'AT',
      'BE',
      'HR',
      'CY',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PT',
      'SK',
      'SI',
      'ES',
    ]);

    if (euroCountries.has(normalizedCountryCode)) {
      return 'EUR';
    }

    const countryCurrencyMap: Readonly<Record<string, string>> = {
      AE: 'AED',
      AU: 'AUD',
      CA: 'CAD',
      CH: 'CHF',
      CZ: 'CZK',
      DK: 'DKK',
      HK: 'HKD',
      HU: 'HUF',
      ID: 'IDR',
      IL: 'ILS',
      JP: 'JPY',
      MY: 'MYR',
      NO: 'NOK',
      NZ: 'NZD',
      PH: 'PHP',
      PL: 'PLN',
      SA: 'SAR',
      SE: 'SEK',
      SG: 'SGD',
      TH: 'THB',
      TR: 'TRY',
      ZA: 'ZAR',
    };

    return countryCurrencyMap[normalizedCountryCode] ?? 'USD';
  }

  private getMarketplaceCurrencyExponent(currency: string): number {
    const normalizedCurrency = currency.trim().toUpperCase();

    const zeroDecimalCurrencies = new Set(['JPY']);

    if (zeroDecimalCurrencies.has(normalizedCurrency)) {
      return 0;
    }

    const threeDecimalCurrencies = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

    if (threeDecimalCurrencies.has(normalizedCurrency)) {
      return 3;
    }

    return 2;
  }

  private marketplaceAmountToSubunits(
    amount: number,
    currency: string,
  ): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Marketplace payment amount is invalid');
    }

    const exponent = this.getMarketplaceCurrencyExponent(currency);
    const multiplier = 10 ** exponent;
    const subunits = Math.round(amount * multiplier);

    if (!Number.isSafeInteger(subunits) || subunits <= 0) {
      throw new BadRequestException(
        'Marketplace payment amount cannot be represented safely',
      );
    }

    return subunits;
  }
  private async resolveMarketplaceLiveFxQuote(
    baseCurrency: string,
    paymentCurrency: string,
  ): Promise<{
    baseCurrency: string;
    paymentCurrency: string;
    rate: number;
    quotedAt: Date;
    source: string;
  }> {
    const normalizedBaseCurrency = baseCurrency.trim().toUpperCase();
    const normalizedPaymentCurrency = paymentCurrency.trim().toUpperCase();

    if (!normalizedBaseCurrency || !normalizedPaymentCurrency) {
      throw new BadRequestException('Marketplace FX currencies are invalid');
    }

    if (normalizedBaseCurrency === normalizedPaymentCurrency) {
      return {
        baseCurrency: normalizedBaseCurrency,
        paymentCurrency: normalizedPaymentCurrency,
        rate: 1,
        quotedAt: new Date(),
        source: 'IDENTITY',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url =
        `https://api.frankfurter.dev/v2/rate/` +
        `${encodeURIComponent(normalizedBaseCurrency)}/` +
        `${encodeURIComponent(normalizedPaymentCurrency)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadGatewayException(
          'Marketplace FX provider returned an unsuccessful response',
        );
      }

      const payload = (await response.json()) as unknown;

      if (!payload || typeof payload !== 'object' || !('rate' in payload)) {
        throw new BadGatewayException(
          'Marketplace FX provider response is invalid',
        );
      }

      const rawRate = (payload as { rate?: unknown }).rate;

      const rate = typeof rawRate === 'number' ? rawRate : Number(rawRate);

      if (!Number.isFinite(rate) || rate <= 0) {
        throw new BadGatewayException(
          'Marketplace FX provider returned an invalid rate',
        );
      }

      return {
        baseCurrency: normalizedBaseCurrency,
        paymentCurrency: normalizedPaymentCurrency,
        rate,
        quotedAt: new Date(),
        source: 'FRANKFURTER',
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException('Marketplace FX provider timed out');
      }

      throw new BadGatewayException(
        'Marketplace FX rate is temporarily unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private calculateMarketplaceConvertedPaymentAmount(
    baseAmount: Prisma.Decimal,
    fxRate: number,
    paymentCurrency: string,
  ): {
    paymentAmount: Prisma.Decimal;
    razorpayAmountSubunits: number;
  } {
    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      throw new BadRequestException('Marketplace FX rate is invalid');
    }

    const normalizedCurrency = paymentCurrency.trim().toUpperCase();
    const exponent = this.getMarketplaceCurrencyExponent(normalizedCurrency);

    const convertedAmount = new Prisma.Decimal(baseAmount)
      .mul(fxRate)
      .toDecimalPlaces(exponent, Prisma.Decimal.ROUND_HALF_UP);

    if (convertedAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Marketplace converted payment amount is invalid',
      );
    }

    const numericAmount = convertedAmount.toNumber();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException(
        'Marketplace converted payment amount is outside supported range',
      );
    }

    const razorpayAmountSubunits = this.marketplaceAmountToSubunits(
      numericAmount,
      normalizedCurrency,
    );

    return {
      paymentAmount: convertedAmount,
      razorpayAmountSubunits,
    };
  }
  async createMarketplaceRazorpayOrder(supabaseId: string, orderId: string) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const livePaymentsEnabled =
      process.env.MARKETPLACE_LIVE_PAYMENTS_ENABLED?.trim().toLowerCase() ===
      'true';

    if (!livePaymentsEnabled) {
      throw new ServiceUnavailableException(
        'Marketplace live payments are currently disabled',
      );
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim();

    if (!razorpayKeyId) {
      throw new InternalServerErrorException(
        'Razorpay checkout configuration is unavailable',
      );
    }

    const marketplaceOrder = await this.prisma.marketplaceOrder.findFirst({
      where: {
        id: orderId,
        customerUserId: user.id,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currency: true,
        grandTotal: true,
        countryCode: true,

        paymentCountryCode: true,
        paymentCurrency: true,
        paymentAmount: true,
        paymentFxRate: true,
        paymentFxQuotedAt: true,
        razorpayAmountSubunits: true,

        razorpayOrderId: true,
      },
    });

    if (!marketplaceOrder) {
      throw new NotFoundException('Marketplace order not found');
    }

    if (marketplaceOrder.status !== MarketplaceOrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Marketplace order is not awaiting payment');
    }

    const baseCurrency = marketplaceOrder.currency.trim().toUpperCase();

    if (baseCurrency !== 'INR') {
      throw new BadRequestException(
        'Marketplace base order currency must be INR',
      );
    }

    /*
     * Foreign charging stays disabled until verify + webhook
     * are payment-snapshot aware.
     */
    const internationalPaymentsEnabled =
      process.env.MARKETPLACE_INTERNATIONAL_PAYMENTS_ENABLED?.trim().toLowerCase() ===
      'true';

    const paymentCountryCode =
      this.normalizeMarketplacePaymentCountryCode(
        marketplaceOrder.countryCode,
      ) || 'IN';

    const requestedPaymentCurrency =
      this.resolveMarketplacePaymentCurrency(paymentCountryCode);

    const paymentCurrency = internationalPaymentsEnabled
      ? requestedPaymentCurrency
      : 'INR';

    /*
     * Provider order already exists:
     * reuse its immutable payment snapshot.
     */
    if (marketplaceOrder.razorpayOrderId) {
      const existingCurrency =
        marketplaceOrder.paymentCurrency?.trim().toUpperCase() || baseCurrency;

      const existingAmount =
        marketplaceOrder.paymentAmount ?? marketplaceOrder.grandTotal;

      let existingSubunits: number;

      if (marketplaceOrder.razorpayAmountSubunits) {
        existingSubunits = marketplaceOrder.razorpayAmountSubunits.toNumber();

        if (!Number.isSafeInteger(existingSubunits) || existingSubunits <= 0) {
          throw new ConflictException(
            'Marketplace Razorpay amount snapshot is invalid',
          );
        }
      } else {
        existingSubunits = this.marketplaceAmountToSubunits(
          existingAmount.toNumber(),
          existingCurrency,
        );
      }

      return {
        success: true,
        message: 'Marketplace Razorpay order already created',
        data: {
          keyId: razorpayKeyId,
          marketplaceOrderId: marketplaceOrder.id,
          orderNumber: marketplaceOrder.orderNumber,
          razorpayOrderId: marketplaceOrder.razorpayOrderId,

          baseCurrency,
          baseAmount: marketplaceOrder.grandTotal,

          paymentCountryCode:
            marketplaceOrder.paymentCountryCode ?? paymentCountryCode,

          requestedPaymentCurrency,

          currency: existingCurrency,
          amount: existingAmount,
          amountSubunits: existingSubunits,

          fxRate: marketplaceOrder.paymentFxRate ?? new Prisma.Decimal(1),

          fxQuotedAt: marketplaceOrder.paymentFxQuotedAt,

          internationalPaymentsEnabled,
        },
      };
    }

    /*
     * INR->INR = identity quote.
     * Foreign quote is used only after explicit production enablement.
     */
    const fxQuote = await this.resolveMarketplaceLiveFxQuote(
      baseCurrency,
      paymentCurrency,
    );

    const converted = this.calculateMarketplaceConvertedPaymentAmount(
      marketplaceOrder.grandTotal,
      fxQuote.rate,
      paymentCurrency,
    );

    const paymentAmount = converted.paymentAmount;
    const amountSubunits = converted.razorpayAmountSubunits;

    if (!Number.isSafeInteger(amountSubunits) || amountSubunits <= 0) {
      throw new BadRequestException(
        'Marketplace payment subunit amount is invalid',
      );
    }

    const razorpayOrder = await getRazorpayInstance().orders.create({
      amount: amountSubunits,
      currency: paymentCurrency,
      receipt: marketplaceOrder.orderNumber.slice(0, 40),
      notes: {
        marketplaceOrderId: marketplaceOrder.id,
        marketplaceOrderNumber: marketplaceOrder.orderNumber,
        baseCurrency,
        paymentCurrency,
        paymentCountryCode,
      },
    });

    if (!razorpayOrder?.id) {
      throw new ConflictException(
        'Razorpay did not return an order identifier',
      );
    }

    const attached = await this.prisma.marketplaceOrder.updateMany({
      where: {
        id: marketplaceOrder.id,
        customerUserId: user.id,
        status: MarketplaceOrderStatus.PENDING_PAYMENT,
        razorpayOrderId: null,
      },
      data: {
        razorpayOrderId: razorpayOrder.id,
        paymentCountryCode,
        paymentCurrency,
        paymentAmount,
        paymentFxRate: new Prisma.Decimal(fxQuote.rate),
        paymentFxQuotedAt: fxQuote.quotedAt,
        razorpayAmountSubunits: new Prisma.Decimal(amountSubunits),
      },
    });

    if (attached.count !== 1) {
      const concurrentOrder = await this.prisma.marketplaceOrder.findFirst({
        where: {
          id: marketplaceOrder.id,
          customerUserId: user.id,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          currency: true,
          grandTotal: true,
          paymentCountryCode: true,
          paymentCurrency: true,
          paymentAmount: true,
          paymentFxRate: true,
          paymentFxQuotedAt: true,
          razorpayAmountSubunits: true,
          razorpayOrderId: true,
        },
      });

      if (
        concurrentOrder?.status === MarketplaceOrderStatus.PENDING_PAYMENT &&
        concurrentOrder.razorpayOrderId
      ) {
        const concurrentCurrency =
          concurrentOrder.paymentCurrency?.trim().toUpperCase() ||
          concurrentOrder.currency.trim().toUpperCase();

        const concurrentAmount =
          concurrentOrder.paymentAmount ?? concurrentOrder.grandTotal;

        const concurrentSubunits =
          concurrentOrder.razorpayAmountSubunits?.toNumber() ??
          this.marketplaceAmountToSubunits(
            concurrentAmount.toNumber(),
            concurrentCurrency,
          );

        if (
          !Number.isSafeInteger(concurrentSubunits) ||
          concurrentSubunits <= 0
        ) {
          throw new ConflictException(
            'Marketplace concurrent payment snapshot is invalid',
          );
        }

        return {
          success: true,
          message: 'Marketplace Razorpay order already created',
          data: {
            keyId: razorpayKeyId,

            marketplaceOrderId: concurrentOrder.id,
            orderNumber: concurrentOrder.orderNumber,
            razorpayOrderId: concurrentOrder.razorpayOrderId,

            baseCurrency: concurrentOrder.currency.trim().toUpperCase(),

            baseAmount: concurrentOrder.grandTotal,

            paymentCountryCode:
              concurrentOrder.paymentCountryCode ?? paymentCountryCode,

            requestedPaymentCurrency,

            currency: concurrentCurrency,
            amount: concurrentAmount,
            amountSubunits: concurrentSubunits,

            fxRate: concurrentOrder.paymentFxRate ?? new Prisma.Decimal(1),

            fxQuotedAt: concurrentOrder.paymentFxQuotedAt,

            internationalPaymentsEnabled,
          },
        };
      }

      throw new ConflictException(
        'Marketplace payment order state changed. Please retry.',
      );
    }

    return {
      success: true,
      message: 'Marketplace Razorpay order created',
      data: {
        keyId: razorpayKeyId,

        marketplaceOrderId: marketplaceOrder.id,
        orderNumber: marketplaceOrder.orderNumber,
        razorpayOrderId: razorpayOrder.id,

        baseCurrency,
        baseAmount: marketplaceOrder.grandTotal,

        paymentCountryCode,
        requestedPaymentCurrency,

        currency: paymentCurrency,
        amount: paymentAmount,
        amountSubunits,

        fxRate: new Prisma.Decimal(fxQuote.rate),
        fxQuotedAt: fxQuote.quotedAt,

        internationalPaymentsEnabled,
      },
    };
  }
  async prepareCustomerOrder(
    supabaseId: string,
    dto: PrepareMarketplaceOrderDto,
  ) {
    const user = await this.resolveMarketplaceCustomer(supabaseId);

    const prepareIdempotencyKey = dto.idempotencyKey.trim();

    if (!prepareIdempotencyKey) {
      throw new BadRequestException(
        'Marketplace prepare idempotency key is required',
      );
    }

    const existingPreparedOrder = await this.prisma.marketplaceOrder.findFirst({
      where: {
        customerUserId: user.id,
        prepareIdempotencyKey,
      },
      include: {
        sellerOrders: {
          include: {
            items: true,
          },
        },
      },
    });

    if (existingPreparedOrder) {
      return {
        success: true,
        message: 'Marketplace order prepared for payment',
        data: existingPreparedOrder,
      };
    }

    const addressId = dto.addressId.trim();

    const address = await this.prisma.marketplaceAddress.findFirst({
      where: {
        id: addressId,
        userId: user.id,
      },
    });

    if (!address) {
      throw new NotFoundException('Marketplace address not found');
    }

    const cart = await this.prisma.marketplaceCart.findUnique({
      where: {
        userId: user.id,
      },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            product: {
              include: {
                category: true,
                images: {
                  select: {
                    id: true,
                  },
                  take: 1,
                },
                astrologer: {
                  include: {
                    user: true,
                    marketplaceSellerProfile: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Marketplace cart is empty');
    }

    const currencies = new Set<string>();
    const sellerGroups = new Map<
      string,
      {
        astrologerId: string;
        sellerDisplayName: string;
        subtotal: Prisma.Decimal;
        shippingTotal: Prisma.Decimal;
        items: Array<{
          productId: string;
          productName: string;
          productSku: string;
          currency: string;
          mrp: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          quantity: number;
          shippingCharge: Prisma.Decimal;
          lineSubtotal: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
        }>;
      }
    >();

    let subtotal = new Prisma.Decimal(0);
    let shippingTotal = new Prisma.Decimal(0);

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      const sellerProfile = product.astrologer.marketplaceSellerProfile;

      const eligible =
        product.status === MarketplaceProductStatus.ACTIVE &&
        product.stock > 0 &&
        product.images.length > 0 &&
        product.category.isActive &&
        product.astrologer.isApproved &&
        product.astrologer.isVerified &&
        product.astrologer.user.isActive &&
        !product.astrologer.user.isBlocked &&
        sellerProfile?.status === MarketplaceSellerStatus.ACTIVE;

      if (!eligible) {
        throw new BadRequestException(
          `Product "${product.name}" is no longer available`,
        );
      }

      if (cartItem.quantity <= 0 || cartItem.quantity > product.stock) {
        throw new BadRequestException(
          `Only ${product.stock} item(s) available for "${product.name}"`,
        );
      }

      const currency = product.currency.trim().toUpperCase();

      if (!currency) {
        throw new BadRequestException(
          `Currency is missing for "${product.name}"`,
        );
      }

      currencies.add(currency);

      if (currencies.size > 1) {
        throw new BadRequestException(
          'Marketplace cart cannot contain multiple currencies',
        );
      }

      if (currency !== 'INR') {
        throw new BadRequestException(
          'Marketplace checkout currently supports INR only',
        );
      }

      const unitPrice = new Prisma.Decimal(product.sellingPrice);
      const mrp = new Prisma.Decimal(product.mrp);
      const shippingCharge = new Prisma.Decimal(product.shippingCharge);
      const quantity = cartItem.quantity;

      const lineSubtotal = unitPrice.mul(quantity);

      // Existing marketplace cart semantics charge shipping once per line.
      const lineTotal = lineSubtotal.add(shippingCharge);

      subtotal = subtotal.add(lineSubtotal);
      shippingTotal = shippingTotal.add(shippingCharge);

      const sellerName =
        sellerProfile?.shopDisplayName?.trim() ||
        product.astrologer.user.name?.trim() ||
        'Marketplace Seller';

      const existingGroup = sellerGroups.get(product.astrologerId);

      const orderItem = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku?.trim() || product.id,
        currency,
        mrp,
        unitPrice,
        quantity,
        shippingCharge,
        lineSubtotal,
        lineTotal,
      };

      if (existingGroup) {
        existingGroup.subtotal = existingGroup.subtotal.add(lineSubtotal);

        existingGroup.shippingTotal =
          existingGroup.shippingTotal.add(shippingCharge);

        existingGroup.items.push(orderItem);
      } else {
        sellerGroups.set(product.astrologerId, {
          astrologerId: product.astrologerId,
          sellerDisplayName: sellerName,
          subtotal: lineSubtotal,
          shippingTotal: shippingCharge,
          items: [orderItem],
        });
      }
    }

    if (sellerGroups.size === 0) {
      throw new BadRequestException(
        'Marketplace cart has no eligible products',
      );
    }

    const currency = Array.from(currencies)[0] ?? 'INR';
    const grandTotal = subtotal.add(shippingTotal);

    let order;

    try {
      order = await this.prisma.$transaction(async (tx) => {
        /*
         * Payment is intentionally deferred.
         *
         * PENDING_PAYMENT orders DO NOT decrement stock and are not
         * fulfillment-ready. Stock must be revalidated and decremented
         * atomically only after verified payment confirmation.
         */

        const orderNumber =
          'ASP-MKT-' +
          Date.now().toString(36).toUpperCase() +
          '-' +
          randomBytes(4).toString('hex').toUpperCase();

        return tx.marketplaceOrder.create({
          data: {
            orderNumber,
            customerUserId: user.id,
            prepareIdempotencyKey,
            status: 'PENDING_PAYMENT',
            currency,
            subtotal,
            shippingTotal,
            grandTotal,

            fullName: address.fullName,
            phone: address.phone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            countryCode: address.countryCode,

            sellerOrders: {
              create: Array.from(sellerGroups.values()).map((sellerGroup) => ({
                astrologerId: sellerGroup.astrologerId,
                sellerDisplayName: sellerGroup.sellerDisplayName,
                currency,
                subtotal: sellerGroup.subtotal,
                shippingTotal: sellerGroup.shippingTotal,
                grandTotal: sellerGroup.subtotal.add(sellerGroup.shippingTotal),

                items: {
                  create: sellerGroup.items.map((item) => ({
                    productId: item.productId,
                    productName: item.productName,
                    productSku: item.productSku,
                    currency: item.currency,
                    mrp: item.mrp,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    shippingCharge: item.shippingCharge,
                    lineSubtotal: item.lineSubtotal,
                    lineTotal: item.lineTotal,
                  })),
                },
              })),
            },
          },
          include: {
            sellerOrders: {
              include: {
                items: true,
              },
            },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicatePreparedOrder =
          await this.prisma.marketplaceOrder.findFirst({
            where: {
              customerUserId: user.id,
              prepareIdempotencyKey,
            },
            include: {
              sellerOrders: {
                include: {
                  items: true,
                },
              },
            },
          });

        if (duplicatePreparedOrder) {
          order = duplicatePreparedOrder;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    return {
      success: true,
      message: 'Marketplace order prepared for payment',
      data: order,
    };
  }

  async getSellerOrders(supabaseId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const orders = await this.prisma.marketplaceSellerOrder.findMany({
      where: {
        astrologerId: astrologer.id,
        order: {
          status: {
            in: [
              MarketplaceOrderStatus.CONFIRMED,
              MarketplaceOrderStatus.PROCESSING,
              MarketplaceOrderStatus.COMPLETED,
            ],
          },
        },
      },
      include: {
        items: true,
        order: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: orders,
    };
  }

  async getSellerOrder(supabaseId: string, sellerOrderId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const sellerOrder = await this.prisma.marketplaceSellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        astrologerId: astrologer.id,
        order: {
          status: {
            in: [
              MarketplaceOrderStatus.CONFIRMED,
              MarketplaceOrderStatus.PROCESSING,
              MarketplaceOrderStatus.COMPLETED,
            ],
          },
        },
      },
      include: {
        items: true,
        order: true,
      },
    });

    if (!sellerOrder) {
      throw new NotFoundException('Marketplace seller order not found');
    }

    return {
      success: true,
      data: sellerOrder,
    };
  }

  async acceptSellerOrder(supabaseId: string, sellerOrderId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const sellerOrder = await this.prisma.marketplaceSellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        astrologerId: astrologer.id,
      },
      include: {
        order: true,
      },
    });

    if (!sellerOrder) {
      throw new NotFoundException('Marketplace seller order not found');
    }

    if (
      sellerOrder.order.status !== MarketplaceOrderStatus.CONFIRMED &&
      sellerOrder.order.status !== MarketplaceOrderStatus.PROCESSING
    ) {
      throw new BadRequestException(
        'This marketplace order is not fulfillment-ready',
      );
    }

    if (sellerOrder.status !== MarketplaceFulfillmentStatus.PENDING) {
      throw new BadRequestException(
        'Only pending seller orders can be accepted',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const acceptTransition = await tx.marketplaceSellerOrder.updateMany({
        where: {
          id: sellerOrder.id,
          status: MarketplaceFulfillmentStatus.PENDING,
        },
        data: {
          status: MarketplaceFulfillmentStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      if (acceptTransition.count !== 1) {
        throw new ConflictException(
          'Marketplace seller order was already changed by another request',
        );
      }

      const updated = await tx.marketplaceSellerOrder.findUnique({
        where: {
          id: sellerOrder.id,
        },
        include: {
          items: true,
          order: true,
        },
      });

      if (!updated) {
        throw new ConflictException(
          'Marketplace seller order disappeared after accept transition',
        );
      }

      if (sellerOrder.order.status === MarketplaceOrderStatus.CONFIRMED) {
        await tx.marketplaceOrder.update({
          where: {
            id: sellerOrder.orderId,
          },
          data: {
            status: MarketplaceOrderStatus.PROCESSING,
          },
        });
      }

      return updated;
    });

    return {
      success: true,
      message: 'Marketplace seller order accepted',
      data: result,
    };
  }

  async processSellerOrder(supabaseId: string, sellerOrderId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const sellerOrder = await this.prisma.marketplaceSellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        astrologerId: astrologer.id,
        order: {
          status: {
            in: [
              MarketplaceOrderStatus.CONFIRMED,
              MarketplaceOrderStatus.PROCESSING,
            ],
          },
        },
      },
    });

    if (!sellerOrder) {
      throw new NotFoundException('Marketplace seller order not found');
    }

    if (sellerOrder.status !== MarketplaceFulfillmentStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted seller orders can move to processing',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const processTransition = await tx.marketplaceSellerOrder.updateMany({
        where: {
          id: sellerOrder.id,
          status: MarketplaceFulfillmentStatus.ACCEPTED,
        },
        data: {
          status: MarketplaceFulfillmentStatus.PROCESSING,
        },
      });

      if (processTransition.count !== 1) {
        throw new ConflictException(
          'Marketplace seller order was already changed by another request',
        );
      }

      const updated = await tx.marketplaceSellerOrder.findUnique({
        where: {
          id: sellerOrder.id,
        },
        include: {
          items: true,
          order: true,
        },
      });

      if (!updated) {
        throw new ConflictException(
          'Marketplace seller order disappeared after process transition',
        );
      }

      await tx.marketplaceOrder.updateMany({
        where: {
          id: sellerOrder.orderId,
          status: MarketplaceOrderStatus.CONFIRMED,
        },
        data: {
          status: MarketplaceOrderStatus.PROCESSING,
        },
      });

      return updated;
    });

    return {
      success: true,
      message: 'Marketplace seller order is processing',
      data: result,
    };
  }

  async shipSellerOrder(
    supabaseId: string,
    sellerOrderId: string,
    dto: ShipMarketplaceOrderDto,
  ) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const sellerOrder = await this.prisma.marketplaceSellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        astrologerId: astrologer.id,
        order: {
          status: MarketplaceOrderStatus.PROCESSING,
        },
      },
    });

    if (!sellerOrder) {
      throw new NotFoundException('Marketplace seller order not found');
    }

    if (sellerOrder.status !== MarketplaceFulfillmentStatus.PROCESSING) {
      throw new BadRequestException(
        'Only processing seller orders can be shipped',
      );
    }

    const trackingCarrier = dto.trackingCarrier.trim();
    const trackingNumber = dto.trackingNumber.trim();

    if (!trackingCarrier || !trackingNumber) {
      throw new BadRequestException(
        'Tracking carrier and tracking number are required',
      );
    }

    const shipTransition = await this.prisma.marketplaceSellerOrder.updateMany({
      where: {
        id: sellerOrder.id,
        astrologerId: astrologer.id,
        status: MarketplaceFulfillmentStatus.PROCESSING,
      },
      data: {
        status: MarketplaceFulfillmentStatus.SHIPPED,
        trackingCarrier,
        trackingNumber,
        shippedAt: new Date(),
      },
    });

    if (shipTransition.count !== 1) {
      throw new ConflictException(
        'Marketplace seller order was already changed by another request',
      );
    }

    const updated = await this.prisma.marketplaceSellerOrder.findUnique({
      where: {
        id: sellerOrder.id,
      },
      include: {
        items: true,
        order: true,
      },
    });

    if (!updated) {
      throw new ConflictException(
        'Marketplace seller order disappeared after ship transition',
      );
    }

    return {
      success: true,
      message: 'Marketplace seller order shipped',
      data: updated,
    };
  }

  async deliverSellerOrder(supabaseId: string, sellerOrderId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const sellerOrder = await this.prisma.marketplaceSellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        astrologerId: astrologer.id,
        order: {
          status: MarketplaceOrderStatus.PROCESSING,
        },
      },
    });

    if (!sellerOrder) {
      throw new NotFoundException('Marketplace seller order not found');
    }

    if (sellerOrder.status !== MarketplaceFulfillmentStatus.SHIPPED) {
      throw new BadRequestException(
        'Only shipped seller orders can be delivered',
      );
    }

    const runDeliveryTransaction = async () =>
      this.prisma.$transaction(
        async (tx) => {
          const deliveryTransition = await tx.marketplaceSellerOrder.updateMany(
            {
              where: {
                id: sellerOrder.id,
                status: MarketplaceFulfillmentStatus.SHIPPED,
              },
              data: {
                status: MarketplaceFulfillmentStatus.DELIVERED,
                deliveredAt: new Date(),
              },
            },
          );

          if (deliveryTransition.count !== 1) {
            throw new ConflictException(
              'Marketplace seller order was already changed by another request',
            );
          }

          const updated = await tx.marketplaceSellerOrder.findUnique({
            where: {
              id: sellerOrder.id,
            },
            include: {
              items: true,
              order: true,
            },
          });

          if (!updated) {
            throw new ConflictException(
              'Marketplace seller order disappeared after delivery transition',
            );
          }
          if (!sellerOrder.astrologerId) {
            throw new ConflictException(
              'Marketplace seller order is missing astrologer ownership',
            );
          }

          const sellerAstrologerId = sellerOrder.astrologerId;
          const earningRelease = await tx.marketplaceSellerEarning.updateMany({
            where: {
              sellerOrderId: sellerOrder.id,
              astrologerId: sellerAstrologerId,
              status: 'PENDING',
              payoutId: null,
            },
            data: {
              status: 'AVAILABLE',
              availableAt: new Date(),
            },
          });

          if (earningRelease.count > 1) {
            throw new ConflictException(
              'Unexpected duplicate marketplace earnings for seller order',
            );
          }

          const remaining = await tx.marketplaceSellerOrder.count({
            where: {
              orderId: sellerOrder.orderId,
              status: {
                not: MarketplaceFulfillmentStatus.DELIVERED,
              },
            },
          });

          if (remaining === 0) {
            await tx.marketplaceOrder.update({
              where: {
                id: sellerOrder.orderId,
              },
              data: {
                status: MarketplaceOrderStatus.COMPLETED,
                completedAt: new Date(),
              },
            });
          }

          return updated;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

    let result: Awaited<ReturnType<typeof runDeliveryTransaction>> | null =
      null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await runDeliveryTransaction();
        break;
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!retryable || attempt === 3) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
      }
    }

    if (!result) {
      throw new ConflictException(
        'Marketplace delivery could not complete safely',
      );
    }

    return {
      success: true,
      message: 'Marketplace seller order delivered',
      data: result,
    };
  }

  async getCustomerOrders(supabaseId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        supabaseId,
        isActive: true,
        isBlocked: false,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    const orders = await this.prisma.marketplaceOrder.findMany({
      where: {
        customerUserId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sellerOrders: {
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return {
      success: true,
      data: orders,
    };
  }

  async getCustomerOrder(supabaseId: string, orderId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        supabaseId,
        isActive: true,
        isBlocked: false,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    const order = await this.prisma.marketplaceOrder.findFirst({
      where: {
        id: orderId,
        customerUserId: user.id,
      },
      include: {
        sellerOrders: {
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Marketplace order not found');
    }

    return {
      success: true,
      data: order,
    };
  }

  /**
   * Creates immutable marketplace earning snapshots only after
   * server-side verified payment has moved the marketplace order
   * to CONFIRMED inside the same transaction.
   *
   * Commission is snapshotted per seller order so later platform
   * commission changes never rewrite historical earnings.
   *
   * Current marketplace rule:
   *   Platform = 30%
   *   Seller/Astrologer = 70%
   */
  private async createMarketplaceEarningsAfterVerifiedPayment(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const order = await tx.marketplaceOrder.findFirst({
      where: {
        id: orderId,
        status: MarketplaceOrderStatus.CONFIRMED,
      },
      select: {
        id: true,
        sellerOrders: {
          select: {
            id: true,
            astrologerId: true,
            currency: true,
            grandTotal: true,
            earning: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new ConflictException(
        'Marketplace earnings can only be created for a confirmed paid order',
      );
    }

    const platformSettings = await tx.platformSettings.findUnique({
      where: {
        id: 'default',
      },
      select: {
        platformCommissionPercent: true,
      },
    });

    const platformFeePercent =
      platformSettings?.platformCommissionPercent ?? new Prisma.Decimal(30);

    if (platformFeePercent.lt(0) || platformFeePercent.gt(100)) {
      throw new ConflictException(
        'Marketplace platform commission must be between 0 and 100',
      );
    }

    let createdCount = 0;

    for (const sellerOrder of order.sellerOrders) {
      if (!sellerOrder.astrologerId) {
        throw new ConflictException(
          'Marketplace seller order is missing astrologer ownership',
        );
      }

      /*
       * sellerOrderId is UNIQUE on MarketplaceSellerEarning.
       * Existing earning means this payment/order was already
       * snapshotted, so duplicate webhook/retry remains idempotent.
       */
      if (sellerOrder.earning) {
        continue;
      }

      const grossAmount = new Prisma.Decimal(sellerOrder.grandTotal);

      if (grossAmount.lt(0)) {
        throw new ConflictException(
          'Marketplace seller order total cannot be negative',
        );
      }

      const platformFeeAmount = grossAmount
        .mul(platformFeePercent)
        .div(100)
        .toDecimalPlaces(2);

      const netAmount = grossAmount.sub(platformFeeAmount).toDecimalPlaces(2);

      await tx.marketplaceSellerEarning.create({
        data: {
          sellerOrderId: sellerOrder.id,
          astrologerId: sellerOrder.astrologerId,
          currency: sellerOrder.currency.trim().toUpperCase(),
          grossAmount,
          platformFeePercent,
          platformFeeAmount,
          netAmount,
          status: 'PENDING',
        },
      });

      createdCount += 1;
    }

    return {
      createdCount,
      platformFeePercent,
    };
  }
  async getSellerMarketplaceEarnings(supabaseId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const earnings = await this.prisma.marketplaceSellerEarning.findMany({
      where: {
        astrologerId: astrologer.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sellerOrder: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                completedAt: true,
              },
            },
          },
        },
        payout: true,
      },
    });

    const grouped = await this.prisma.marketplaceSellerEarning.groupBy({
      by: ['status', 'currency'],
      where: {
        astrologerId: astrologer.id,
      },
      _sum: {
        grossAmount: true,
        platformFeeAmount: true,
        netAmount: true,
      },
      _count: {
        _all: true,
      },
    });

    return {
      success: true,
      data: {
        summary: grouped,
        earnings,
      },
    };
  }

  async requestSellerMarketplacePayout(supabaseId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const payout = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.marketplaceSellerPayout.findFirst({
          where: {
            astrologerId: astrologer.id,
            status: {
              in: ['REQUESTED', 'PROCESSING'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (existing) {
          throw new BadRequestException(
            'A marketplace payout is already in progress',
          );
        }

        const availableEarnings = await tx.marketplaceSellerEarning.findMany({
          where: {
            astrologerId: astrologer.id,
            status: 'AVAILABLE',
            payoutId: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (availableEarnings.length === 0) {
          throw new BadRequestException(
            'No available marketplace earnings to withdraw',
          );
        }

        const currencies = new Set(
          availableEarnings.map((earning) =>
            earning.currency.trim().toUpperCase(),
          ),
        );

        if (currencies.size !== 1) {
          throw new BadRequestException(
            'Marketplace payout cannot combine multiple currencies',
          );
        }

        const currency = availableEarnings[0].currency.trim().toUpperCase();

        let amount = new Prisma.Decimal(0);

        for (const earning of availableEarnings) {
          amount = amount.add(earning.netAmount);
        }

        if (amount.lte(0)) {
          throw new BadRequestException(
            'Marketplace payout amount must be greater than zero',
          );
        }

        const created = await tx.marketplaceSellerPayout.create({
          data: {
            astrologerId: astrologer.id,
            amount,
            currency,
            status: 'REQUESTED',
            idempotencyKey: randomUUID(),
          },
        });

        const earningIds = availableEarnings.map((earning) => earning.id);

        const reserved = await tx.marketplaceSellerEarning.updateMany({
          where: {
            id: {
              in: earningIds,
            },
            astrologerId: astrologer.id,
            status: 'AVAILABLE',
            payoutId: null,
          },
          data: {
            status: 'PAYOUT_REQUESTED',
            payoutId: created.id,
          },
        });

        if (reserved.count !== earningIds.length) {
          throw new ConflictException(
            'Marketplace earnings changed during payout request',
          );
        }

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,
      message: 'Marketplace payout request created',
      data: payout,
    };
  }
  async getSellerMarketplacePayouts(supabaseId: string) {
    const { astrologer } = await this.requireSellerAstrologer(supabaseId, true);

    const payouts = await this.prisma.marketplaceSellerPayout.findMany({
      where: {
        astrologerId: astrologer.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        earnings: {
          select: {
            id: true,
            sellerOrderId: true,
            currency: true,
            grossAmount: true,
            platformFeePercent: true,
            platformFeeAmount: true,
            netAmount: true,
            status: true,
            availableAt: true,
            paidAt: true,
            reversedAt: true,
          },
        },
      },
    });

    return {
      success: true,
      data: payouts,
    };
  }

  async adminGetMarketplaceOrders() {
    const orders = await this.prisma.marketplaceOrder.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sellerOrders: {
          include: {
            items: true,
            earning: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return {
      success: true,
      data: orders,
    };
  }

  async adminGetMarketplaceOrder(orderId: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: {
        id: orderId,
      },
      include: {
        sellerOrders: {
          include: {
            items: true,
            earning: {
              include: {
                payout: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Marketplace order not found');
    }

    return {
      success: true,
      data: order,
    };
  }

  async adminGetMarketplaceEarnings() {
    const earnings = await this.prisma.marketplaceSellerEarning.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sellerOrder: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        astrologer: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        payout: true,
      },
    });

    const grouped = await this.prisma.marketplaceSellerEarning.groupBy({
      by: ['status', 'currency'],
      _sum: {
        grossAmount: true,
        platformFeeAmount: true,
        netAmount: true,
      },
      _count: {
        _all: true,
      },
    });

    return {
      success: true,
      data: {
        summary: grouped,
        earnings,
      },
    };
  }

  async adminGetMarketplacePayouts() {
    const payouts = await this.prisma.marketplaceSellerPayout.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        astrologer: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        earnings: true,
      },
    });

    return {
      success: true,
      data: payouts,
    };
  }
}
