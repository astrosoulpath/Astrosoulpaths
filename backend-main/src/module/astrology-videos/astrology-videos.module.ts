import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AstrologyVideosAdminController } from './astrology-videos-admin.controller';
import { AstrologyVideosController } from './astrology-videos.controller';
import { AstrologyVideosService } from './astrology-videos.service';

@Module({
  imports: [PrismaModule],
  controllers: [AstrologyVideosAdminController, AstrologyVideosController],
  providers: [AstrologyVideosService],
})
export class AstrologyVideosModule {}
