import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisClient } from '../../config/redis.config';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly prefix = 'astro';

  constructor() {
    // Reuse the same production-safe ioredis settings as BullMQ.
    this.client = createRedisClient('RedisService');
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      this.logger.log('Redis ping succeeded');
    } catch (error) {
      this.logger.error('Redis connection failed during startup', error);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  private formatKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(this.formatKey(key));

      if (!data) return null;

      try {
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    } catch (error) {
      this.logger.error('Redis GET error', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl = 3600): Promise<void> {
    try {
      const data = JSON.stringify(value);

      await this.client.set(this.formatKey(key), data, 'EX', ttl);
    } catch (error) {
      this.logger.error('Redis SET error', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(this.formatKey(key));
    } catch (error) {
      this.logger.error('Redis DEL error', error);
    }
  }

  async setNX(key: string, value: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.set(
        this.formatKey(key),
        value,
        'EX',
        ttl,
        'NX',
      );

      return result === 'OK';
    } catch (error) {
      this.logger.error('Redis SETNX error', error);
      return false;
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(this.formatKey(key));
    } catch (error) {
      this.logger.error('Redis INCR error', error);
      return 0;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.client.expire(this.formatKey(key), ttl);
    } catch (error) {
      this.logger.error('Redis EXPIRE error', error);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(this.formatKey(key));
    } catch (error) {
      this.logger.error('Redis TTL error', error);
      return -1;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.formatKey(key));
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXISTS error', error);
      return false;
    }
  }
}
