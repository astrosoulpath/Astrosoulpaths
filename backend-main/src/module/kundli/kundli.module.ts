import { Module } from '@nestjs/common';
import { KundliService } from './kundli.service';
import { KundliRepository } from './kundli.repository';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { KundliOrderService } from './kundli-order.service';
import { KundliPdfService } from './kundli-pdf.service';

@Module({
  imports: [PrismaModule],
  providers: [
    KundliService,
    KundliRepository,
    KundliOrderService,
    KundliPdfService,
  ],
  exports: [KundliService, KundliOrderService],
})
export class KundliModule {}
