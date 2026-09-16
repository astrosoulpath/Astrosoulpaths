import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { UserModule } from '../user/user.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminReportService } from './admin-report.service';
import { AdminRepository } from './admin.repository';

@Module({
  imports: [PrismaModule, UserModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminReportService, AdminRepository, AdminService],
  exports: [AdminService],
})
export class AdminModule {}

