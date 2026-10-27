jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));
import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

describe('horoscope monitoring authorization and recorded-only totals', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  it('inherits authentication and ADMIN authorization on the new endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata('roles', AdminController)).toEqual(['admin']);
    expect(
      Reflect.getMetadata(
        'path',
        AdminController.prototype.getHoroscopeMonitoring,
      ),
    ).toBe('horoscope/monitoring');
  });
  function fixture() {
    const db: any = {
      subscription: {
        count: jest
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1),
      },
      paymentOrder: { groupBy: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    return {
      db,
      service: new AdminService(
        {} as any,
        {} as any,
        db,
        {} as any,
        {} as any,
        {} as any,
      ),
    };
  }
  it('does not query missing tables or fabricate successful deliveries before activation', async () => {
    delete process.env.HOROSCOPE_SCHEMA_READY;
    const f = fixture();
    const { data } = await f.service.getHoroscopeMonitoring();
    expect(data).toMatchObject({
      active: 2,
      expired: 3,
      pending: 1,
      durableStatus: 'NOT_ACTIVATED',
      schedulerStatus:'DISABLED',
      providerConfigured:false,
      generation: [],
      delivery: [],
    });
    expect(f.db.$queryRaw).not.toHaveBeenCalled();
    expect(f.db.paymentOrder.groupBy.mock.calls[0][0].where).toEqual({
      type:'SUBSCRIPTION',metadata:{path:['planName'],equals:'DAILY_HOROSCOPE_MONTHLY'},
    });
    expect(data.paymentScope).toBe('DAILY_HOROSCOPE_MONTHLY');
  });
  it('aggregates locale/state/failure and attempts without returning private readings', async () => {
    process.env.HOROSCOPE_DURABLE_ENABLED = 'true';
    process.env.HOROSCOPE_SCHEMA_READY = 'true';
    const f = fixture();
    await f.service.getHoroscopeMonitoring();
    expect(f.db.$queryRaw).toHaveBeenCalledTimes(2);
    for (const [sql] of f.db.$queryRaw.mock.calls) {
      expect(sql.join('')).toContain('GROUP BY');
      expect(sql.join('')).not.toMatch(/birth|response|fcmToken/i);
    }
  });
});
