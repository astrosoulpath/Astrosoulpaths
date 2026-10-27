import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Keep local development behavior; production must explicitly name web origins. */
export function createHttpCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  if (env.NODE_ENV !== 'production') return { origin: true, credentials: true };
  const configured = env.CORS_ALLOWED_ORIGINS ?? env.FRONTEND_URL ?? '';
  const origins = configured.split(',').map((value) => value.trim()).filter(Boolean);
  const allowed = new Set<string>();
  for (const value of origins) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
          url.pathname !== '/' || url.origin !== value.replace(/\/$/, '')) {
        throw new Error();
      }
      allowed.add(url.origin);
    } catch {
      // Never repeat a potentially secret-containing malformed configuration.
      throw new Error('Invalid production CORS origin configuration');
    }
  }
  return {
    credentials: true,
    origin: (origin, callback) => callback(null, origin === undefined || allowed.has(origin)),
  };
}
