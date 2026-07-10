import { forwardRef, Module } from '@nestjs/common';

import { KundliService } from './kundli.service';
import { KundliRepository } from './kundli.repository';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { KundliOrderService } from './kundli-order.service';
import { KundliPdfService } from './kundli-pdf.service';
import { KundliController } from './kundli.controller';
import { AstroModule } from '../astro/astro.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AstroModule),
  ],
  controllers: [KundliController],
  providers: [
    KundliService,
    KundliRepository,
    KundliOrderService,
    KundliPdfService,
  ],
  exports: [
    KundliService,
    KundliOrderService,
  ],
})
export class KundliModule {}