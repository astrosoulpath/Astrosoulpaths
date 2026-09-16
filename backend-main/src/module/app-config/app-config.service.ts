import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig() {
    const config = await this.prisma.appConfig.findFirst({
      where: {
        key: 'PUBLIC_APP_CONFIG',
        isActive: true,
      },
      select: {
        shareMessage: true,
        androidStoreUrl: true,
        iosStoreUrl: true,
        websiteUrl: true,
        aboutTitle: true,
        aboutDescription: true,
      },
    });

    if (!config) {
      throw new NotFoundException('Public app configuration is not configured');
    }

    return {
      success: true,
      data: config,
    };
  }
}
