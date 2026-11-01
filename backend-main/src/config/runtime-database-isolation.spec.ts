import { runtimePrismaOptions } from './runtime-database-isolation';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const fixture =
  'postgresql://asp_sg_runtime_v1:synthetic@dpg-dbicfj8n74is73b23i90-a/astro_soul_path?sslmode=require&sslaccept=strict&connection_limit=5';
describe('production runtime database isolation (offline)', () => {
  const env = (): NodeJS.ProcessEnv => ({
    NODE_ENV: 'production',
    DATABASE_URL: fixture,
  });
  it('uses only the restricted datasource', () => {
    expect(runtimePrismaOptions(env())).toEqual({
      datasources: { db: { url: fixture } },
    });
  });
  it.each(['', 'synthetic-owner-secret'])(
    'rejects DIRECT_URL even if empty',
    (value) => {
      expect(() =>
        runtimePrismaOptions({ ...env(), DIRECT_URL: value }),
      ).toThrow('migration credential variable forbidden');
    },
  );
  it.each([
    fixture.replace('asp_sg_runtime_v1', 'primaryuser'),
    fixture.replace(
      'dpg-dbicfj8n74is73b23i90-a',
      'old.oregon-postgres.render.com',
    ),
    fixture.replace('/astro_soul_path', '/wrong'),
    fixture.replace('sslmode=require', 'sslmode=disable'),
    fixture.replace('sslaccept=strict', 'sslaccept=accept_invalid_certs'),
    fixture.replace('connection_limit=5', 'connection_limit=21'),
    fixture + '&host=/var/run/postgresql',
    fixture + '&sslmode=disable',
  ])('rejects unsafe configuration without reflecting input', (url) => {
    const call = () => runtimePrismaOptions({ ...env(), DATABASE_URL: url });
    expect(call).toThrow(
      'Restricted Singapore runtime database configuration required',
    );
    try {
      call();
    } catch (error) {
      expect(String(error)).not.toContain('synthetic');
    }
  });
  it('enforces Render even when NODE_ENV is missing', () => {
    expect(() =>
      runtimePrismaOptions({ RENDER: 'true', DATABASE_URL: 'invalid' }),
    ).toThrow();
  });
  it('preserves nonproduction local configuration behavior', () => {
    expect(runtimePrismaOptions({ NODE_ENV: 'test' })).toEqual({});
  });
  it('constructs the generated Prisma6 client without DIRECT_URL or any connection', () => {
    const prior = process.env;
    const connect = jest.spyOn(PrismaService.prototype, '$connect');
    try {
      process.env = env();
      // Prisma returns a client proxy; instanceof is not its construction contract.
      expect(() => new PrismaService()).not.toThrow();
      expect(connect).not.toHaveBeenCalled();
    } finally {
      process.env = prior;
      connect.mockRestore();
    }
  });
  it('rejects owner credentials before a Prisma connection', () => {
    const prior = process.env;
    const connect = jest.spyOn(PrismaService.prototype, '$connect');
    try {
      process.env = { ...env(), DIRECT_URL: 'synthetic-owner-secret' };
      expect(() => new PrismaService()).toThrow(
        'migration credential variable forbidden',
      );
      expect(connect).not.toHaveBeenCalled();
    } finally {
      process.env = prior;
      connect.mockRestore();
    }
  });
  it('keeps both source and generated runtime schemas free of DIRECT_URL', () => {
    const clientRequire = createRequire(require.resolve('@prisma/client'));
    const generatedSchema = resolve(
      dirname(clientRequire.resolve('.prisma/client/default')),
      'schema.prisma',
    );
    for (const path of [
      resolve(process.cwd(), 'prisma/schema.prisma'),
      generatedSchema,
    ]) {
      expect(readFileSync(path, 'utf8')).not.toContain('DIRECT_URL');
    }
  });
});
