import { AstrologerKundliReportPdfService } from './astrologer-kundli-report-pdf.service';
import { AstrologerKundliReportPdfController } from './astrologer-kundli-report-pdf.controller';
import { AstrologerKundliReportController } from './astrologer-kundli-report.controller';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';
import { forwardRef, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AstroModule } from '../astro/astro.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KundliSubscriptionGuard } from './guards/kundli-subscription.guard';

import { KundliAiService } from './kundli-ai.service';
import { KundliController } from './kundli.controller';
import { KundliOrderService } from './kundli-order.service';
import { KundliPdfService } from './kundli-pdf.service';
import { KundliRepository } from './kundli.repository';
import { KundliSavedRecordService } from './kundli-saved-record.service';
import { KundliService } from './kundli.service';
import { LocalVedicKundliProvider } from './providers/local-vedic-kundli.provider';
import { AstrologerKundliReportAttachmentService } from './astrologer-kundli-report-attachment.service';
import { AstrologerKundliReportAttachmentController } from './astrologer-kundli-report-attachment.controller';
@Module({
  imports: [PrismaModule, forwardRef(() => AstroModule), NotificationsModule],

  controllers: [
    AstrologerKundliReportPdfController,
    AstrologerKundliReportController,
    KundliController,
    AstrologerKundliReportAttachmentController,
  ],

  providers: [
    AstrologerKundliReportPdfService,
    AstrologerKundliReportService,
    KundliService,
    KundliAiService,
    KundliRepository,
    KundliOrderService,
    KundliPdfService,
    LocalVedicKundliProvider,
    {
      provide: 'KUNDLI_PROVIDER',
      useExisting: LocalVedicKundliProvider,
    },
    KundliSubscriptionGuard,
    KundliSavedRecordService,
    AstrologerKundliReportAttachmentService,
  ],

  exports: [KundliService, KundliOrderService, KundliPdfService, LocalVedicKundliProvider],
})
export class KundliModule {}



