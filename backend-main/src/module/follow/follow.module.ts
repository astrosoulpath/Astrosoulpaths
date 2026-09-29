import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';

@Module({
  imports: [PrismaModule],
  controllers: [FollowController],
  providers: [FollowService],
  exports: [FollowService],
})
export class FollowModule {}
