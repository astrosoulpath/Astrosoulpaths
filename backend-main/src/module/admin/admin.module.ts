import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    AdminController,
  ],
  providers: [
    AdminRepository,
    AdminService,
  ],
  exports: [
    AdminService,
  ],
})
export class AdminModule {}