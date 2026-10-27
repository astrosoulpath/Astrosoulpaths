import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const folder = resolve(
  __dirname,
  '../../../review/live/persona-reconciliation',
);
const { validateLocalUrls, compareSchema } = require(
  resolve(folder, 'audit-local.cjs'),
);

describe('Persona reconciliation review safety (offline; no database)', () => {
  const local =
    'postgresql://synthetic:synthetic@127.0.0.1:5432/astro_soul_path';
  it('accepts only the explicitly approved local target for BOTH URLs', () => {
    expect(
      validateLocalUrls({ DATABASE_URL: local, DIRECT_URL: local }).hostname,
    ).toBe('127.0.0.1');
  });
  it.each([
    'postgresql://synthetic:synthetic@remote.invalid:5432/astro_soul_path',
    'postgresql://synthetic:synthetic@127.0.0.1:5433/astro_soul_path',
    'postgresql://synthetic:synthetic@127.0.0.1:5432/other_database',
    'https://127.0.0.1:5432/astro_soul_path',
    local + '?host=remote.invalid',
    local + '?schema=other_schema',
    '',
  ])('rejects unsupported routing or target %s', (bad) => {
    expect(() =>
      validateLocalUrls({ DATABASE_URL: bad, DIRECT_URL: local }),
    ).toThrow();
    expect(() =>
      validateLocalUrls({ DATABASE_URL: local, DIRECT_URL: bad }),
    ).toThrow();
  });
  it('detects definition differences rather than only matching object names', () => {
    const expected = {
      columns: [{ type: 'text[]', not_null: false }],
      indexes: [],
      constraints: [],
    };
    expect(compareSchema({ ...expected }, expected)).toEqual([]);
    expect(
      compareSchema(
        { ...expected, columns: [{ type: 'text[]', not_null: true }] },
        expected,
      ),
    ).toEqual(['columns']);
    expect(
      compareSchema(
        { ...expected, constraints: [{ definition: 'different' }] },
        expected,
      ),
    ).toEqual(['constraints']);
  });
  it('records nullable arrays and original defaults without conversion', () => {
    const snapshot = JSON.parse(
      readFileSync(resolve(folder, 'schema-audit.json'), 'utf8'),
    );
    const sql = readFileSync(
      resolve(folder, 'persona-nullable-baseline.review.sql'),
      'utf8',
    );
    for (const name of ['categories', 'languages', 'expertise']) {
      const field = snapshot.columns.find(
        (c: any) =>
          c.table_name === 'ai_astro_personas' && c.column_name === name,
      );
      expect(field).toMatchObject({ type: 'text[]', not_null: false });
      expect(sql).toContain(`"${name}" text[]`);
      expect(sql).not.toContain(`"${name}" text[] NOT NULL`);
    }
    expect(sql).not.toMatch(
      /\b(?:UPDATE|INSERT|DELETE)\s+(?:INTO|FROM|public\.)/i,
    );
    expect(sql).not.toContain('IF NOT EXISTS');
    expect(sql).toContain('Never execute against existing');
  });
  it.each(['preflight.review.sql', 'postflight.review.sql'])(
    '%s contains no mutation statements',
    (file) => {
      const sql = readFileSync(resolve(folder, file), 'utf8').replace(
        /--[^\n]*/g,
        '',
      );
      expect(sql).toContain('BEGIN READ ONLY');
      expect(sql).toContain('ROLLBACK;');
      expect(sql).not.toMatch(
        /^\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT)\b/im,
      );
    },
  );
});
