import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('HealthService', () => {
  let service: HealthService;
  let database: { $queryRawUnsafe: jest.Mock };
  let redis: { ping: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    database = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    redis = { ping: jest.fn().mockResolvedValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: database },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reports database and Redis independently without writing data', async () => {
    const result = await service.getHealthStatus();
    expect(result.status).toBe('ok');
    expect(result.services).toEqual({ database: 'up', redis: 'up' });
    expect(database.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });

  it('sanitizes database failures', async () => {
    database.$queryRawUnsafe.mockRejectedValue(
      new Error('private-database-detail'),
    );
    await expect(service.getHealthStatus()).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.getHealthStatus()).rejects.toThrow(
      'Database health check failed',
    );
  });

  it('rejects an unavailable Redis dependency', async () => {
    redis.ping.mockResolvedValue(false);
    await expect(service.getHealthStatus()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('bounds a hanging Redis check', async () => {
    redis.ping.mockImplementation(() => new Promise(() => {}));
    const pending = expect(service.getHealthStatus()).rejects.toThrow(
      ServiceUnavailableException,
    );
    await jest.advanceTimersByTimeAsync(3000);
    await pending;
  });
});
