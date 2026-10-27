import { createHttpCorsOptions } from './http-cors.config';

function permitted(env: NodeJS.ProcessEnv, origin?: string): boolean {
  const options = createHttpCorsOptions(env);
  let result = false;
  const policy = options.origin as (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => void;
  policy(origin, (_error, allow) => { result = allow; });
  return result;
}
describe('production HTTP CORS', () => {
  it('preserves local development behavior', () => {
    expect(createHttpCorsOptions({NODE_ENV: 'development'})).toEqual({origin: true, credentials: true});
  });
  it('denies browser origins when production origins are missing', () => {
    expect(permitted({NODE_ENV: 'production'}, 'https://untrusted.example')).toBe(false);
  });
  it('permits exact configured HTTPS origins without suffix matching', () => {
    const env = {NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://admin.example, https://app.example/'};
    expect(permitted(env, 'https://admin.example')).toBe(true);
    expect(permitted(env, 'https://app.example')).toBe(true);
    expect(permitted(env, 'https://admin.example.evil.test')).toBe(false);
    expect(permitted(env, 'http://admin.example')).toBe(false);
    expect(permitted(env, 'null')).toBe(false);
  });
  it('preserves native/server clients without an Origin header and FRONTEND_URL fallback', () => {
    expect(permitted({NODE_ENV: 'production'})).toBe(true);
    expect(permitted({NODE_ENV: 'production', FRONTEND_URL: 'https://app.example'}, 'https://app.example')).toBe(true);
  });
  it.each(['*', 'http://app.example', 'https://app.example/path', 'https://secret:password@app.example', 'https://app.example?token=secret'])('rejects malformed configuration without echoing it', (value) => {
    expect(() => createHttpCorsOptions({NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: value})).toThrow('Invalid production CORS origin configuration');
  });
});
