import { AdminModerationService } from './admin-moderation.service';
import { AdminProductRefundController } from './admin-product-refund.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AdminPaymentOperationsController } from './admin-payment-operations.controller';
import { AdminPaymentOperationsService } from './admin-payment-operations.service';
import { AdminPaymentReconciliationWorker } from './admin-payment-reconciliation.worker';
import { AdminModerationController } from './admin-moderation.controller';
﻿import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { UserModule } from '../user/user.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminReportService } from './admin-report.service';
import { AdminRepository } from './admin.repository';

@Module({
  imports: [PrismaModule, UserModule, NotificationsModule, PaymentsModule],
  controllers: [AdminController, AdminModerationController, AdminPaymentOperationsController, AdminProductRefundController],
  providers: [AdminModerationService, AdminReportService, AdminRepository, AdminService, AdminPaymentOperationsService, AdminPaymentReconciliationWorker],
  exports: [AdminService],
})
export class AdminModule {}

