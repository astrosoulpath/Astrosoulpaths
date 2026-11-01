/** Fail before Prisma can connect. Never include URL/credential values in errors. */
export function runtimePrismaOptions(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production' && !env.RENDER) return {};
  if (Object.prototype.hasOwnProperty.call(env, 'DIRECT_URL')) {
    throw new Error('Runtime migration credential variable forbidden');
  }
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    const resource = 'dpg-dbicfj8n74is73b23i90-a';
    const allowedHosts = [
      resource,
      `${resource}.singapore-postgres.render.com`,
    ];
    const allowedKeys = new Set([
      'schema',
      'sslmode',
      'sslaccept',
      'sslcert',
      'connection_limit',
      'pool_timeout',
      'connect_timeout',
      'pgbouncer',
      'application_name',
    ]);
    const keys = [...url.searchParams.keys()];
    const limit = Number(url.searchParams.get('connection_limit'));
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !allowedHosts.includes(url.hostname) ||
      url.pathname !== '/astro_soul_path' ||
      (url.port && url.port !== '5432') ||
      url.hash ||
      !url.password ||
      decodeURIComponent(url.username) !== 'asp_sg_runtime_v1' ||
      url.searchParams.get('sslmode') !== 'require' ||
      url.searchParams.get('sslaccept') !== 'strict' ||
      (url.searchParams.has('schema') &&
        url.searchParams.get('schema') !== 'public') ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 20 ||
      keys.some((key) => !allowedKeys.has(key)) ||
      new Set(keys).size !== keys.length
    ) {
      throw new Error();
    }
    return { datasources: { db: { url: env.DATABASE_URL! } } };
  } catch {
    throw new Error(
      'Restricted Singapore runtime database configuration required',
    );
  }
}
