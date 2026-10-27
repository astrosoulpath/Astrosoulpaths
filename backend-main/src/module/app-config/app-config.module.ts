import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { AboutCmsService } from './about-cms.service';
import {
  AboutPublicController,
  AboutAdminController,
} from './about-cms.controller';

@Module({
  controllers: [
    AppConfigController,
    AboutPublicController,
    AboutAdminController,
  ],
  providers: [AppConfigService, AboutCmsService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
