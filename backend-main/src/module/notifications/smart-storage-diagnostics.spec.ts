import { requireSmartSchema } from './smart-notification-contract';
import { SmartNotificationsService } from './smart-notifications.service';

describe('smart storage diagnostics preserve activation boundaries', () => {
  const original = process.env.SMART_NOTIFICATIONS_SCHEMA_READY;
  afterEach(() => { if (original === undefined) delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY; else process.env.SMART_NOTIFICATIONS_SCHEMA_READY = original; });
  it('returns allowlisted schema code while storage remains default-off', () => {
    delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY;
    try { requireSmartSchema(); throw new Error('Expected guard'); }
    catch (error) { expect(error.getStatus()).toBe(503); expect(error.getResponse().code).toBe('SMART_SCHEMA_NOT_ACTIVATED'); }
  });
  it('missing category policy prevents campaign and audit inserts', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY = 'true';
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), $executeRaw: jest.fn() };
    const db = { $transaction: jest.fn(fn => fn(tx)) };
    const service = new SmartNotificationsService(db as never, {} as never);
    await expect(service.createCampaign('synthetic-admin', { category:'love',locale:'en',title:'Editorial reflection',body:'Take time for a thoughtful conversation.',expiresAt:new Date(Date.now()+86400000).toISOString() })).rejects.toMatchObject({ response: { code:'SMART_CATEGORY_NOT_INSTALLED' } });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
