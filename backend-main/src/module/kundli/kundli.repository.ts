import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class KundliRepository {
  constructor(private prisma: PrismaService) {}

  async findByHash(hash: string) {
    return this.prisma.kundli.findUnique({
      where: { hash },
      include: { data: true },
    });
  }

  async createKundli(data: any) {
    return this.prisma.kundli.create({
      data,
      include: { data: true },
    });
  }

  async findKundliData(kundliId: string, lang: string) {
    return this.prisma.kundliData.findUnique({
      where: {
        kundliId_lang: {
          kundliId,
          lang,
        },
      },
    });
  }

  // 🔥 FINAL CLEAN VERSION
  async saveKundliData(kundliId: string, lang: string, data: any) {
    return this.prisma.kundliData.upsert({
      where: {
        kundliId_lang: {
          kundliId,
          lang,
        },
      },

      update: {
        vedic: data?.vedic ?? null,
      },

      create: {
        kundliId,
        lang,
        vedic: data?.vedic ?? null,
      },
    });
  }
}
