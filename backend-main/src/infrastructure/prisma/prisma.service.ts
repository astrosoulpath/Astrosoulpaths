import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    console.log('Prisma client connected successfully');
  }

  async onModuleDestroy() {
    console.log('Prisma client disconnected successfully');
    await this.$disconnect();
  }
}
