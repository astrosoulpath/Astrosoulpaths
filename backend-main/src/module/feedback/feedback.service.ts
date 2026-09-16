import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FeedbackCategory, FeedbackStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomer(externalUserId: string) {
    const supabaseId = externalUserId?.trim();

    if (!supabaseId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    const customer = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!customer || !customer.isActive || customer.isBlocked) {
      throw new UnauthorizedException('Active customer account is required');
    }

    return customer;
  }

  async create(externalUserId: string, dto: CreateFeedbackDto) {
    const customer = await this.resolveCustomer(externalUserId);

    const message = dto.message.trim();

    const feedback = await this.prisma.feedback.create({
      data: {
        customerId: customer.id,
        category: dto.category,
        rating: dto.rating,
        message,
      },
      select: {
        id: true,
        category: true,
        rating: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    };
  }

  async getMine(externalUserId: string) {
    const customer = await this.resolveCustomer(externalUserId);

    const items = await this.prisma.feedback.findMany({
      where: {
        customerId: customer.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        category: true,
        rating: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: items,
    };
  }

  async getAdminList(input: {
    page: number;
    limit: number;
    status?: FeedbackStatus;
    category?: FeedbackCategory;
  }) {
    const page = Math.max(1, input.page);
    const limit = Math.min(Math.max(1, input.limit), 100);

    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.feedback.count({
        where,
      }),
    ]);

    return {
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getAdminById(id: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: {
        id,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return {
      success: true,
      data: feedback,
    };
  }

  async updateStatus(id: string, dto: UpdateFeedbackStatusDto) {
    const existing = await this.prisma.feedback.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Feedback not found');
    }

    const now = new Date();

    const feedback = await this.prisma.feedback.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
        ...(dto.adminNote !== undefined
          ? {
              adminNote: dto.adminNote.trim() || null,
            }
          : {}),
        ...(dto.status === FeedbackStatus.REVIEWED
          ? {
              reviewedAt: now,
            }
          : {}),
        ...(dto.status === FeedbackStatus.RESOLVED
          ? {
              reviewedAt: now,
              resolvedAt: now,
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Feedback status updated successfully',
      data: feedback,
    };
  }
}
