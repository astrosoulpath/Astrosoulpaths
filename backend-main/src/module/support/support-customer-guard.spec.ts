jest.mock('../../infrastructure/supabase/communication-auth.service', () => ({ CommunicationAuthService: class {} }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../user/user.service', () => ({ UserService: class {} }));
jest.mock('../../common/guards/supabase-auth.guard', () => ({ SupabaseAuthGuard: class {} }));
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NotificationsIdentityGuard } from '../notifications/notifications-identity.guard';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support-admin.controller';
import * as policy from '../../common/auth/admin-identity-policy';

describe('Customer support authentication boundary', () => {
  afterEach(() => jest.restoreAllMocks());
  const canonical = (role = 'CUSTOMER') => ({
    sub: 'synthetic-canonical-subject', asp_user_id: 'synthetic-user',
    asp_account_role: role, exp: Date.now() / 1000 + 3600,
  });
  function setup(identity: unknown) {
    const verify = jest.fn().mockResolvedValue(identity);
    const request = { headers: { authorization: 'Bearer synthetic-test-only' }, user: undefined };
    const guard = new NotificationsIdentityGuard({ verify } as never, {} as never);
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as never;
    return { guard, request, context, verify };
  }
  it('customer and admin ticket controllers have separate route prefixes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SupportController)).toBe('support');
    expect(Reflect.getMetadata(PATH_METADATA, SupportAdminController)).toBe('admin/support');
    expect(Reflect.getMetadata(GUARDS_METADATA, SupportController)).toEqual([NotificationsIdentityGuard]);
  });
  it.each(['CUSTOMER', 'USER'])('canonical %s never enters Admin authorization', async role => {
    const bind = jest.spyOn(policy, 'bindAdminRequest');
    const identity = canonical(role);
    const { guard, context, request } = setup(identity);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(identity);
    expect(bind).not.toHaveBeenCalled();
  });
  it('missing canonical mapping is 401 rather than the Admin-policy denial', async () => {
    const bind = jest.spyOn(policy, 'bindAdminRequest');
    const { guard, context } = setup({ sub: 'unmapped', exp: Date.now() / 1000 + 3600 });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bind).not.toHaveBeenCalled();
  });
  it('canonical Admin keeps the single-Google-identity restriction on shared routes', async () => {
    const bind = jest.spyOn(policy, 'bindAdminRequest').mockRejectedValue(new ForbiddenException('Admin identity is not authorized'));
    const { guard, context } = setup(canonical('ADMIN'));
    await expect(guard.canActivate(context)).rejects.toThrow('Admin identity is not authorized');
    expect(bind).toHaveBeenCalledTimes(1);
  });
  it('revoked or invalid authentication cannot reach Admin binding or services', async () => {
    const bind = jest.spyOn(policy, 'bindAdminRequest');
    const { guard, context, verify } = setup(canonical());
    verify.mockRejectedValue(new UnauthorizedException('Communication authentication required'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bind).not.toHaveBeenCalled();
  });
});
