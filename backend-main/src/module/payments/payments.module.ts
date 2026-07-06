import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { KundliModule } from '../kundli/kundli.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayVerificationService } from './razorpay-verification.service';

@Module({
  imports: [PrismaModule, KundliModule],
  providers: [PaymentsService, RazorpayVerificationService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
