import { createRequire } from 'node:module';

// Test the actual build-tool dependency, not a parent directory's package.
const buildRequire = createRequire(require.resolve('ts-jest/package.json'));
const handlebars = buildRequire('handlebars') as {
  compile(source: string): (context: object, options?: object) => string;
};

describe('patched build template security', () => {
  it('does not expose the own constructor of a function prototype', () => {
    expect(handlebars.compile('{{lookup fn "constructor"}}')(
      { fn: Function.prototype }, { allowProtoMethodsByDefault: true },
    )).toBe('');
  });
  it('retains normal interpolation and HTML escaping', () => {
    expect(handlebars.compile('Hello {{name}}')({ name: '<synthetic>' })).toBe('Hello &lt;synthetic&gt;');
  });
});
