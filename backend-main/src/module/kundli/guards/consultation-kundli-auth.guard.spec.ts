jest.mock(
  '../../../infrastructure/supabase/communication-auth.service',
  () => ({ CommunicationAuthService: class CommunicationAuthService {} }),
);
import { ConsultationKundliAuthGuard } from './consultation-kundli-auth.guard';
describe('consultation Kundli read-only authentication', () => {
  it.each([
    ['customer', 'POST', '/kundli/v1/consultations/:id/generate', false],
    ['admin', 'GET', '/kundli/v1/consultations/:id/consent', false],
    ['astrologer', 'POST', '/kundli/v1/consultations/:id/consent', false],
    ['astrologer', 'DELETE', '/kundli/v1/consultations/:id/consent', false],
    ['astrologer', 'POST', '/kundli/v1/consultations/:id/generate', true],
    ['customer', 'POST', '/kundli/v1/consultations/:id/consent', true],
  ])(
    'enforces signed %s context for %s %s',
    async (portal, method, path, allowed) => {
      const request = {
        headers: { authorization: 'Bearer synthetic' },
        method,
        route: { path },
      };
      const identity = {
        sub: 'canonical',
        asp_user_id: 'synthetic',
        exp: Date.now() / 1000 + 60,
        asp_context: portal,
      };
      const result = new ConsultationKundliAuthGuard({
        verify: jest.fn().mockResolvedValue(identity),
      } as never).canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as never);
      if (allowed) await expect(result).resolves.toBe(true);
      else await expect(result).rejects.toThrow('account context');
    },
  );
  const context = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as never;
  it.each([
    undefined,
    '',
    'Bearer ',
    'Bearer local-dev-token:any',
    'Basic fake',
  ])('rejects absent or local bypass credentials %s', async (header) => {
    const verify = jest.fn();
    await expect(
      new ConsultationKundliAuthGuard({ verify } as never).canActivate(
        context(header),
      ),
    ).rejects.toThrow();
    expect(verify).not.toHaveBeenCalled();
  });
  it('accepts canonical mapped identity without provisioning methods', async () => {
    const request = {
      headers: { authorization: 'Bearer synthetic' },
      user: undefined,
    };
    const identity = {
      sub: 'canonical',
      asp_user_id: 'existing',
      exp: Date.now() / 1000 + 60,
    };
    const verify = jest.fn().mockResolvedValue(identity);
    const guard = new ConsultationKundliAuthGuard({ verify } as never);
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as never),
    ).resolves.toBe(true);
    expect(request.user).toEqual(identity);
  });
  it.each([
    { sub: 'canonical', exp: Date.now() / 1000 + 60 },
    { sub: 'canonical', asp_user_id: 'existing', exp: 1 },
  ])('rejects unmapped or expired canonical state', async (identity) => {
    await expect(
      new ConsultationKundliAuthGuard({
        verify: jest.fn().mockResolvedValue(identity),
      } as never).canActivate(context('Bearer synthetic')),
    ).rejects.toThrow();
  });
  it.each(['revoked', 'disabled', 'invalid'])(
    'fails closed on verifier %s',
    async () => {
      await expect(
        new ConsultationKundliAuthGuard({
          verify: jest.fn().mockRejectedValue(new Error()),
        } as never).canActivate(context('Bearer synthetic')),
      ).rejects.toThrow();
    },
  );
});
