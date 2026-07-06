// config/redis.config.ts
import { Logger } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';

const logger = new Logger('Redis');
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_LOCAL_REDIS_URL = `redis://localhost:${DEFAULT_REDIS_PORT}`;

export type RedisConnectionOptions = RedisOptions;

function isRenderEnvironment(): boolean {
  return Boolean(process.env.RENDER);
}

function buildRedisUrlFromParts(): string {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = process.env.REDIS_PORT ?? String(DEFAULT_REDIS_PORT);
  const password = process.env.REDIS_PASSWORD;
  const protocol = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';

  if (!password) {
    return `${protocol}://${host}:${port}`;
  }

  return `${protocol}://:${encodeURIComponent(password)}@${host}:${port}`;
}

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    return redisUrl;
  }

  if (
    process.env.REDIS_HOST ||
    process.env.REDIS_PORT ||
    process.env.REDIS_PASSWORD
  ) {
    return buildRedisUrlFromParts();
  }

  if (!isRenderEnvironment()) {
    logger.warn(
      `REDIS_URL is not set. Falling back to local Redis at ${DEFAULT_LOCAL_REDIS_URL}.`,
    );
    return DEFAULT_LOCAL_REDIS_URL;
  }

  throw new Error(
    'REDIS_URL is required on Render. Use the Render Internal Key Value URL for backend-to-Redis traffic.',
  );
}

function parseRedisDatabase(pathname: string): number {
  if (!pathname || pathname === '/') {
    return 0;
  }

  const database = Number(pathname.slice(1));
  return Number.isNaN(database) ? 0 : database;
}

export function createRedisConnectionOptions(): RedisConnectionOptions {
  const redisUrl = getRedisUrl();
  const parsedUrl = new URL(redisUrl);
  const isTlsConnection = parsedUrl.protocol === 'rediss:';

  if (!isRenderEnvironment() && /^red-[a-z0-9]+$/i.test(parsedUrl.hostname)) {
    logger.warn(
      `Redis host "${parsedUrl.hostname}" looks like a Render internal hostname. It will only resolve from another Render service on the same private network.`,
    );
  }

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : DEFAULT_REDIS_PORT,
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db: parseRedisDatabase(parsedUrl.pathname),
    tls: isTlsConnection ? {} : undefined,
    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 200, 2000),
  };
}

export function attachRedisEventListeners(
  client: Redis,
  connectionName = 'Redis',
): void {
  client.on('ready', () => {
    logger.log(`${connectionName} connection ready`);
  });

  client.on('error', (error: Error) => {
    logger.error(`${connectionName} connection error`, error.stack);
  });

  client.on('reconnecting', () => {
    logger.warn(`${connectionName} reconnecting`);
  });
}

export function createRedisClient(connectionName?: string): Redis {
  const client = new Redis(createRedisConnectionOptions());
  attachRedisEventListeners(client, connectionName);
  return client;
}
