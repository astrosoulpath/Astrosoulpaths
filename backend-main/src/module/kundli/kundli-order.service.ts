import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  KundliOrder,
  KundliOrderStatus,
  PaymentOrder,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KundliPdfService } from './kundli-pdf.service';

interface CreateProcessingKundliOrderInput {
  paymentOrderId: string;
  userId: string;
  kundliId?: string;
}

interface KundliPaymentMetadata {
  kundliId: string;
  lang?: string;
}

@Injectable()
export class KundliOrderService {
  private readonly logger = new Logger(KundliOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kundliPdfService: KundliPdfService,
  ) {}

  async assertKundliExists(kundliId: string): Promise<void> {
    const kundli = await this.prisma.kundli.findUnique({
      where: { id: kundliId },
      select: { id: true },
    });

    if (!kundli) {
      throw new NotFoundException('Kundli not found');
    }
  }

  getKundliPaymentMetadata(
    paymentOrder: Pick<PaymentOrder, 'id' | 'metadata'>,
  ): KundliPaymentMetadata {
    const metadata = paymentOrder.metadata;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new BadRequestException('Kundli payment metadata is missing');
    }

    const kundliId =
      'kundliId' in metadata && typeof metadata.kundliId === 'string'
        ? metadata.kundliId
        : undefined;
    const lang =
      'lang' in metadata && typeof metadata.lang === 'string'
        ? metadata.lang
        : undefined;

    if (!kundliId) {
      throw new BadRequestException('Kundli payment metadata is invalid');
    }

    return { kundliId, lang };
  }

  async createProcessingOrder(
    tx: Prisma.TransactionClient,
    input: CreateProcessingKundliOrderInput,
  ): Promise<KundliOrder> {
    return tx.kundliOrder.upsert({
      where: { paymentOrderId: input.paymentOrderId },
      update: {
        status: KundliOrderStatus.PROCESSING,
        kundliId: input.kundliId,
      },
      create: {
        paymentOrderId: input.paymentOrderId,
        userId: input.userId,
        kundliId: input.kundliId,
        status: KundliOrderStatus.PROCESSING,
      },
    });
  }

  async triggerPdfGeneration(
    kundliOrderId: string,
    paymentOrder: PaymentOrder,
  ) {
    const metadata = this.getKundliPaymentMetadata(paymentOrder);

    await this.kundliPdfService.triggerGeneration({
      kundliOrderId,
      kundliId: metadata.kundliId,
      lang: metadata.lang,
    });

    this.logger.log(
      `kundli_order.generation_triggered kundliOrderId=${kundliOrderId} paymentOrderId=${paymentOrder.id}`,
    );
  }

  async markGenerationFailed(kundliOrderId: string, reason: string) {
    await this.prisma.kundliOrder.update({
      where: { id: kundliOrderId },
      data: { status: KundliOrderStatus.FAILED },
    });

    this.logger.error(
      `kundli_order.generation_failed kundliOrderId=${kundliOrderId} reason=${reason}`,
    );
  }
}
