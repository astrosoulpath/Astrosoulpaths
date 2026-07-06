import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { ProfileModule } from '../../../profile/profile.module';
import { MatchService } from './match.service';
import { VedicProvider } from '../provider/vedic.provider';

@Module({
  imports: [
    ProfileModule, // ⭐ gives ProfileService
  ],
  providers: [MatchService, VedicProvider],
  controllers: [MatchController],
  exports: [MatchService],
})
export class MatchModule {}
