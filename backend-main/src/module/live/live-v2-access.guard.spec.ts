import { ConfigService } from '@nestjs/config';
import { LiveV2AccessGuard } from './live-v2-access.guard';

describe('Live v2 HTTP activation and rate limits', () => {
  const context = (sub?: string): any => ({
    switchToHttp: () => ({
      getRequest: () => ({ user: sub ? { sub } : undefined }),
    }),
  });
  const config = () =>
    new ConfigService({
      LIVE_V2_ENABLED: 'true',
      LIVE_V2_SOCKET_SINGLE_INSTANCE: 'true',
    });
  afterEach(() => jest.restoreAllMocks());
  it.each([
    {},
    { LIVE_V2_ENABLED: 'true' },
    { LIVE_V2_SOCKET_SINGLE_INSTANCE: 'true' },
  ])('fails closed for missing activation gate %j', (flags) => {
    expect(() =>
      new LiveV2AccessGuard(new ConfigService(flags)).canActivate(
        context('canonical'),
      ),
    ).toThrow('not enabled');
  });
  it('requires authenticated server identity', () => {
    expect(() =>
      new LiveV2AccessGuard(config()).canActivate(context()),
    ).toThrow();
  });
  it('bounds requests per identity, isolates users and expires windows', () => {
    let time = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => time);
    const guard = new LiveV2AccessGuard(config());
    for (let n = 0; n < 120; n++)
      expect(guard.canActivate(context('canonical'))).toBe(true);
    try {
      guard.canActivate(context('canonical'));
      throw new Error('limit bypass');
    } catch (error: any) {
      expect(error.getStatus()).toBe(429);
    }
    expect(guard.canActivate(context('other'))).toBe(true);
    time += 60000;
    expect(guard.canActivate(context('canonical'))).toBe(true);
  });
});
