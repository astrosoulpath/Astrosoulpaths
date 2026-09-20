import { forwardRef, Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { ProfileModule } from '../../../profile/profile.module';
import { KundliModule } from '../../../kundli/kundli.module';
import { MatchService } from './match.service';
@Module({
  imports: [
    ProfileModule,
    forwardRef(() => KundliModule),
  ],
  providers: [MatchService],
  controllers: [MatchController],
  exports: [MatchService],
})
export class MatchModule {}

