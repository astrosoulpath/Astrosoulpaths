import { type BullRootModuleOptions } from '@nestjs/bullmq';
import {
  type JobsOptions,
  type QueueOptions,
  type WorkerOptions,
} from 'bullmq';
import { createRedisConnectionOptions } from '../../config/redis.config';

export const bullmqDefaultJobOptions: JobsOptions = {
  // Keep completed jobs lean in production while preserving failures for debugging.
  removeOnComplete: 100,
  removeOnFail: 500,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};

export function createBullMQRootConfig(): BullRootModuleOptions {
  return {
    connection: createRedisConnectionOptions(),
    defaultJobOptions: bullmqDefaultJobOptions,
  } satisfies BullRootModuleOptions;
}

export function createBullMQQueueOptions(): Pick<
  QueueOptions,
  'connection' | 'defaultJobOptions'
> {
  return {
    connection: createRedisConnectionOptions(),
    defaultJobOptions: bullmqDefaultJobOptions,
  } satisfies Pick<QueueOptions, 'connection' | 'defaultJobOptions'>;
}

export function createBullMQWorkerOptions(): Pick<WorkerOptions, 'connection'> {
  return {
    connection: createRedisConnectionOptions(),
  } satisfies Pick<WorkerOptions, 'connection'>;
}
