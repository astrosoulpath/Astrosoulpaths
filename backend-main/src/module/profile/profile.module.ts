import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { AiAstrologerAvatarService } from './ai-astrologer-avatar.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { AstroModule } from '../astro/astro.module';
import { KundliModule } from '../kundli/kundli.module';

@Module({
  imports: [AstroModule, KundliModule, SupabaseModule], // needed
  controllers: [ProfileController],
  providers: [ProfileService, PrismaService, AiAstrologerAvatarService],
  exports: [ProfileService],
})
export class ProfileModule {}
