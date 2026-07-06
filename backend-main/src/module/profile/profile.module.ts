import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AstroModule } from '../astro/astro.module';

@Module({
  imports: [AstroModule], // 🔥 needed
  controllers: [ProfileController],
  providers: [ProfileService, PrismaService],
  exports: [ProfileService],
})
export class ProfileModule {}
