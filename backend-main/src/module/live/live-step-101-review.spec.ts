import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

const root = resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const sql = read('review/live/step-101-astrologer-follow.review.sql');
describe('Step 101 preparation (offline contracts; no PostgreSQL execution)', () => {
  it('retains current source composition without requiring private archived rehearsal results',()=>{const schema=read('../review/payments/fresh-production-prisma/schema.prisma');expect(schema).toContain('model AstrologerFollow');expect(schema).toContain('@@unique([followerId, astrologerId])');});
  it('fails closed on wrong database/server/role and unexpected existing table', () => {
    for (const condition of [
      "current_database() IS DISTINCT FROM 'asp_live_v2_rehearsal_20261014_01'",
      "inet_server_addr() IS DISTINCT FROM inet '127.0.0.1'",
      'inet_server_port() IS DISTINCT FROM 5432',
      "current_user IS DISTINCT FROM 'postgres'",
      'AstrologerFollow already exists',
    ])
      expect(sql).toContain(condition);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain("lock_timeout = '5s'");
    expect(sql).toContain("statement_timeout = '60s'");
  });
  it('matches Prisma columns and client-generated uuid semantics', () => {
    const model = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'AstrologerFollow',
    )!;
    expect(
      model.fields
        .filter((field) => field.kind === 'scalar')
        .map((field) => field.name),
    ).toEqual(['id', 'followerId', 'astrologerId', 'createdAt']);
    expect(model.fields.find((field) => field.name === 'id')).toMatchObject({
      isId: true,
      type: 'String',
      default: { name: 'uuid' },
    });
    expect(sql).toContain('"id" TEXT NOT NULL,');
    expect(sql).toContain(
      '"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
    expect(sql).toContain('PRIMARY KEY ("id")');
  });
  it.each(['followerId', 'astrologerId'])(
    'declares indexed FK and cascade semantics for %s (not a behavioral proof)',
    (field) => {
      const parent = field === 'followerId' ? 'User' : 'Astrologer';
      expect(sql).toContain(
        `FOREIGN KEY ("${field}") REFERENCES public."${parent}"("id")`,
      );
      expect(sql).toContain(`CREATE INDEX "AstrologerFollow_${field}_idx"`);
      expect(
        (sql.match(/ON DELETE CASCADE ON UPDATE CASCADE/g) || []).length,
      ).toBe(2);
    },
  );
  it('enforces composite uniqueness required by service upsert', () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "AstrologerFollow_followerId_astrologerId_key"',
    );
    expect(sql).toContain('("followerId", "astrologerId");');
    expect(read('src/module/follow/follow.service.ts')).toContain(
      'followerId_astrologerId',
    );
  });
  it('does not modify rows, existing objects or migration tracking', () => {
    const statements = sql.replace(/--[^\n]*/g, '');
    expect(statements).not.toMatch(
      /^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/im,
    );
    expect(statements).not.toContain('_prisma_migrations');
    expect(statements).not.toContain('IF NOT EXISTS');
  });
});
