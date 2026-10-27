import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AstrologerKundliReportStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateAstrologerKundliReportDto } from './dto/update-astrologer-kundli-report.dto';

@Injectable()
export class AstrologerKundliReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Canonical authenticated identity resolution.
   *
   * UserAuthIdentity is authoritative.
   * User.supabaseId is retained as a legacy fallback.
   * Internal User.id is supported for local/dev authentication.
   */
  async resolveAuthenticatedUserId(authenticatedSubject: string) {
    const normalized = authenticatedSubject?.trim();

    if (!normalized) {
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
      });
    }

    const mappedIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalized,
        },
      },
      select: {
        userId: true,
      },
    });

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          ...(mappedIdentity?.userId ? [{ id: mappedIdentity.userId }] : []),
          { supabaseId: normalized },
          { id: normalized },
        ],
      },
      select: {
        id: true,
        isActive: true,
        isBlocked: true,
      },
      take: 2,
    });

    // A linked identity and a legacy anchor must never select different owners.
    // Do not let findFirst's unspecified row order choose which reports to expose.
    if (
      users.length > 1 ||
      (mappedIdentity?.userId && users[0]?.id !== mappedIdentity.userId)
    ) {
      throw new UnauthorizedException(
        'Canonical identity mapping is ambiguous',
      );
    }
    const user = users[0];

    if (!user) {
      throw new NotFoundException({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Authenticated user account was not found',
      });
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException({
        success: false,
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'User account is inactive or blocked',
      });
    }

    return user.id;
  }

  /**
   * CallSession.astrologerId references internal User.id.
   *
   * Ownership is therefore checked against kundliAccess.userId,
   * not Astrologer.id.
   */
  private async requireOwnedConsultation(
    callSessionId: string,
    authenticatedUserId: string,
  ) {
    const consultation = await this.prisma.callSession.findUnique({
      where: { id: callSessionId },
      select: {
        id: true,
        userId: true,
        astrologerId: true,
      },
    });

    if (!consultation) {
      throw new NotFoundException({
        success: false,
        code: 'CONSULTATION_NOT_FOUND',
        message: 'Consultation was not found',
      });
    }

    if (consultation.astrologerId !== authenticatedUserId) {
      throw new ForbiddenException({
        success: false,
        code: 'CONSULTATION_ACCESS_DENIED',
        message:
          'This consultation does not belong to the authenticated astrologer',
      });
    }

    return consultation;
  }

  async createOrGetDraft(callSessionId: string, authenticatedUserId: string) {
    const consultation = await this.requireOwnedConsultation(
      callSessionId,
      authenticatedUserId,
    );

    const existing = await this.prisma.astrologerKundliReport.findUnique({
      where: { callSessionId },
      include: { attachments: true },
    });

    if (existing) {
      if (
        existing.astrologerId !== authenticatedUserId ||
        existing.customerUserId !== consultation.userId
      ) {
        throw new ConflictException('Report ownership could not be verified.');
      }
      return existing;
    }

    try {
      return await this.prisma.astrologerKundliReport.create({
        data: {
          callSessionId: consultation.id,
          customerUserId: consultation.userId,
          astrologerId: consultation.astrologerId,
          status: AstrologerKundliReportStatus.DRAFT,
        },
        include: { attachments: true },
      });
    } catch (error) {
      // Two retries may both observe no draft. The database unique key decides
      // the winner; never create another report or overwrite the winner.
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const winner = await this.prisma.astrologerKundliReport.findUnique({
        where: { callSessionId: consultation.id },
        include: { attachments: true },
      });
      if (
        !winner ||
        winner.astrologerId !== authenticatedUserId ||
        winner.customerUserId !== consultation.userId
      ) {
        throw new ConflictException('Report ownership could not be verified.');
      }
      return winner;
    }
  }

  async updateDraft(
    reportId: string,
    authenticatedUserId: string,
    input: UpdateAstrologerKundliReportDto,
  ) {
    const report = await this.prisma.astrologerKundliReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        astrologerId: true,
        status: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        success: false,
        code: 'KUNDLI_REPORT_NOT_FOUND',
        message: 'Professional Kundli report was not found',
      });
    }

    if (report.astrologerId !== authenticatedUserId) {
      throw new ForbiddenException({
        success: false,
        code: 'KUNDLI_REPORT_ACCESS_DENIED',
        message: 'This report does not belong to the authenticated astrologer',
      });
    }

    if (report.status !== AstrologerKundliReportStatus.DRAFT) {
      throw new ConflictException({
        success: false,
        code: 'KUNDLI_REPORT_ALREADY_FINAL',
        message: 'A finalized Kundli report cannot be edited',
      });
    }

    try {
      return await this.prisma.astrologerKundliReport.update({
        where: {
          id: report.id,
          astrologerId: authenticatedUserId,
          status: AstrologerKundliReportStatus.DRAFT,
        },
        data: input,
        include: { attachments: true },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2025') throw error;
      throw new ConflictException('The report changed. Reload before editing.');
    }
  }

  async finalize(reportId: string, authenticatedUserId: string) {
    const report = await this.prisma.astrologerKundliReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        astrologerId: true,
        status: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        success: false,
        code: 'KUNDLI_REPORT_NOT_FOUND',
        message: 'Professional Kundli report was not found',
      });
    }

    if (report.astrologerId !== authenticatedUserId) {
      throw new ForbiddenException({
        success: false,
        code: 'KUNDLI_REPORT_ACCESS_DENIED',
        message: 'This report does not belong to the authenticated astrologer',
      });
    }

    if (report.status === AstrologerKundliReportStatus.FINAL) {
      return this.prisma.astrologerKundliReport.findUnique({
        where: { id: report.id },
        include: { attachments: true },
      });
    }

    try {
      return await this.prisma.astrologerKundliReport.update({
        where: {
          id: report.id,
          astrologerId: authenticatedUserId,
          status: AstrologerKundliReportStatus.DRAFT,
        },
        data: {
          status: AstrologerKundliReportStatus.FINAL,
          finalizedAt: new Date(),
        },
        include: { attachments: true },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2025') throw error;
      const finalized = await this.prisma.astrologerKundliReport.findUnique({
        where: { id: report.id },
        include: { attachments: true },
      });
      if (
        finalized?.astrologerId === authenticatedUserId &&
        finalized.status === AstrologerKundliReportStatus.FINAL
      )
        return finalized;
      throw new ConflictException(
        'The report changed. Reload before finalizing.',
      );
    }
  }

  async listForAstrologer(authenticatedUserId: string) {
    return this.prisma.astrologerKundliReport.findMany({
      where: {
        astrologerId: authenticatedUserId,
      },
      include: {
        attachments: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async listFinalForCustomer(customerUserId: string) {
    return this.prisma.astrologerKundliReport.findMany({
      where: {
        customerUserId,
        status: AstrologerKundliReportStatus.FINAL,
      },
      include: {
        attachments: true,
      },
      orderBy: {
        finalizedAt: 'desc',
      },
    });
  }
}
