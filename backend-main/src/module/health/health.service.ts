import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getHealthStatus() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status = database === 'up' && redis === 'up' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return 'up';
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException('Database health check failed');
      }
      throw new InternalServerErrorException('Database health check failed');
    }
  }

  private async checkRedis() {
    const isReady = await this.redis.ping();

    if (!isReady) {
      throw new ServiceUnavailableException('Redis health check failed');
    }

    return 'up';
  }
}
