import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AstrologerController } from './astrologer.controller';
import { AstrologerService } from './astrologer.service';

@Module({
  imports: [PrismaModule],
  controllers: [AstrologerController],
  providers: [AstrologerService],
})
export class AstrologerModule {}