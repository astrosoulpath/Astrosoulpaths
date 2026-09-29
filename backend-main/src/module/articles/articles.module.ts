import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ArticlesAdminController } from './articles-admin.controller';
import { ArticlesAstrologerController } from './articles-astrologer.controller';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  imports: [PrismaModule],
  controllers: [ArticlesAdminController, ArticlesController, ArticlesAstrologerController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
