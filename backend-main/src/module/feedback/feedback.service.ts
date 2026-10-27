import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  resolveSupportActor,
  supportLock,
  supportText,
} from '../support/support-policy';
import {
  auditSupport,
  requireSupportOperations,
} from '../support/support-operations';
import { randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FeedbackCategory, FeedbackStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomer(externalUserId: string) {
    const user = await resolveSupportActor(this.prisma, {
      sub: externalUserId,
    });
    if (!['USER', 'CUSTOMER'].includes(user.role.name.toUpperCase()))
      throw new ForbiddenException(
        'Customer feedback requires a customer account',
      );
    return user;
  }

  async create(externalUserId: string, dto: CreateFeedbackDto) {
    const customer = await this.resolveCustomer(externalUserId);

    const message = supportText(dto.message, 2000, 3);

    const feedback = await this.prisma.$transaction(async (tx) => {
      await supportLock(tx, 'feedback:' + customer.id);
      if (dto.consultationId) {
        requireSupportOperations();
        if (
          !(await tx.callSession.findFirst({
            where: { id: dto.consultationId, userId: customer.id },
            select: { id: true },
          }))
        )
          throw new ForbiddenException('Consultation is not accessible');
      }

      let duplicate = await tx.feedback.findFirst({
        where: {
          customerId: customer.id,
          category: dto.category,
          message,
          rating: dto.rating ?? null,
          createdAt: { gte: new Date(Date.now() - 300000) },
        },
      });
      if (duplicate && dto.consultationId) {
        const context = await tx.$queryRaw<
          Array<{ consultationId: string }>
        >`SELECT "consultationId" FROM public."FeedbackContext" WHERE "feedbackId"=${duplicate.id}`;
        if (context[0]?.consultationId !== dto.consultationId) duplicate = null;
      }
      if (duplicate)
        return {
          id: duplicate.id,
          category: duplicate.category,
          rating: duplicate.rating,
          message: duplicate.message,
          status: duplicate.status,
          createdAt: duplicate.createdAt,
        };
      if (
        (await tx.feedback.count({
          where: {
            customerId: customer.id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 10
      )
        throw new BadRequestException(
          'Feedback limit reached. Please try later.',
        );
      const created = await tx.feedback.create({
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

      if (dto.consultationId)
        await tx.$executeRaw`INSERT INTO public."FeedbackContext" ("feedbackId","consultationId") VALUES (${created.id},${dto.consultationId})`;
      await auditSupport(tx, customer.id, 'FEEDBACK', created.id, 'CREATED');
      return created;
    });
    return {
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    };
  }

  async getMine(externalUserId: string, page = 1) {
    const customer = await this.resolveCustomer(externalUserId);

    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new BadRequestException('Invalid pagination');
    const items = await this.prisma.feedback.findMany({
      skip: (page - 1) * 25,
      take: 25,
      where: {
        customerId: customer.id,
      },
      orderBy: [{createdAt:'desc'},{id:'desc'}],
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
    search?: string;
  }) {
    if (
      !Number.isSafeInteger(input.page) ||
      input.page < 1 ||
      input.page > 100000 ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    )
      throw new BadRequestException('Invalid pagination');
    if (input.status && !Object.values(FeedbackStatus).includes(input.status))
      throw new BadRequestException('Invalid feedback status');
    if (
      input.category &&
      !Object.values(FeedbackCategory).includes(input.category)
    )
      throw new BadRequestException('Invalid feedback category');
    if (input.search && input.search.length > 160)
      throw new BadRequestException('Invalid search');
    const page = input.page;
    const limit = Math.min(Math.max(1, input.limit), 100);

    const where: Prisma.FeedbackWhereInput = {
      ...(input.search?.trim()
        ? {
            OR: [
              {
                message: {
                  contains: input.search.trim(),
                  mode: 'insensitive' as const,
                },
              },
              {
                customer: {
                  is: {
                    OR: [
                      {
                        name: {
                          contains: input.search.trim(),
                          mode: 'insensitive',
                        },
                      },
                      {
                        email: {
                          contains: input.search.trim(),
                          mode: 'insensitive',
                        },
                      },
                      { phone: { contains: input.search.trim() } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{createdAt:'desc'},{id:'desc'}],
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

  async stats() {
    const [total, fresh, reviewed, resolved] = await this.prisma.$transaction([
      this.prisma.feedback.count(),
      this.prisma.feedback.count({ where: { status: 'NEW' } }),
      this.prisma.feedback.count({ where: { status: 'REVIEWED' } }),
      this.prisma.feedback.count({ where: { status: 'RESOLVED' } }),
    ]);
    return {
      success: true,
      data: {
        total,
        new: fresh,
        reviewed,
        resolved,
        operationsEnabled:
          process.env.SUPPORT_OPERATIONS_SCHEMA_READY === 'true' &&
          process.env.SUPPORT_OPERATIONS_ENABLED === 'true',
      },
    };
  }
  async audit(id: string, page = 1) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new BadRequestException('Invalid pagination');
    if (
      !(
        process.env.SUPPORT_OPERATIONS_SCHEMA_READY === 'true' &&
        process.env.SUPPORT_OPERATIONS_ENABLED === 'true'
      )
    )
      return { success: true, enabled: false, items: [] };
    const items = await this.prisma
      .$queryRaw`SELECT "id","actorId","action","details","createdAt" FROM public."SupportOperationAudit" WHERE "objectType"='FEEDBACK' AND "objectId"=${id} ORDER BY "createdAt" DESC,"id" LIMIT 25 OFFSET ${(page - 1) * 25}`;
    return { success: true, enabled: true, items };
  }

  async escalate(actor: { sub?: string }, id: string) {
    requireSupportOperations();
    const admin = await resolveSupportActor(this.prisma, actor, true);
    return this.prisma.$transaction(async (tx) => {
      await supportLock(tx, 'feedback-id:' + id);
      const feedback = await tx.feedback.findUniqueOrThrow({ where: { id } });
      const prior = await tx.$queryRaw<
        Array<{ ticketId: string }>
      >`SELECT "ticketId" FROM public."FeedbackEscalation" WHERE "feedbackId"=${id}`;
      if (prior.length)
        return { success: true, ticketId: prior[0].ticketId, duplicate: true };
      const ticket = await tx.supportTicket.create({
        data: {
          ticketNumber: 'ASP-' + randomUUID(),
          customerId: feedback.customerId,
          subject: 'Feedback follow-up',
          description: feedback.message,
          category: 'GENERAL',
          priority: 'NORMAL',
          status: 'OPEN',
        },
      });
      await tx.$executeRaw`INSERT INTO public."FeedbackEscalation" ("feedbackId","ticketId") VALUES (${id},${ticket.id})`;
      await auditSupport(tx, admin.id, 'FEEDBACK', id, 'ESCALATED', {
        ticketId: ticket.id,
      });
      await auditSupport(
        tx,
        admin.id,
        'TICKET',
        ticket.id,
        'CREATED_FROM_FEEDBACK',
        {},
        feedback.customerId,
        'feedback:' + id,
      );
      return { success: true, ticketId: ticket.id, duplicate: false };
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateFeedbackStatusDto,
    actor?: { sub?: string },
  ) {
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

    const admin = await resolveSupportActor(this.prisma, actor, true);
    const feedback = await this.prisma.$transaction(async (tx) => {
      await supportLock(tx, 'feedback-id:' + id);
      const updated = await tx.feedback.update({
        where: {
          id,
        },
        data: {
          status: dto.status,
          reviewedAt: dto.status === FeedbackStatus.NEW ? null : now,
          resolvedAt: dto.status === FeedbackStatus.RESOLVED ? now : null,
          ...(dto.adminNote !== undefined
            ? {
                adminNote: dto.adminNote.trim() || null,
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

      await auditSupport(tx, admin.id, 'FEEDBACK', id, 'MODERATED', {
        status: dto.status,
      });
      return updated;
    });
    return {
      success: true,
      message: 'Feedback status updated successfully',
      data: feedback,
    };
  }
}
