jest.mock('./guards/consultation-kundli-auth.guard', () => ({
  ConsultationKundliAuthGuard: class ConsultationKundliAuthGuard {},
}));
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConsultationKundliV1Service } from './consultation-kundli-v1.service';
import { ConsultationKundliV1Controller } from './consultation-kundli-v1.controller';

describe('prepared consultation Kundli API boundary', () => {
  it.each([-90, -66.5, 66.5, 90])(
    'reports unsupported KP latitude %s before calculation',
    async (latitude) => {
      const engine = { generate: jest.fn() };
      const service = new ConsultationKundliV1Service(
        {} as never,
        engine as never,
      );
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        userProfile: {
          findUnique: jest.fn().mockResolvedValue({
            dateOfBirth: new Date('2000-01-01T00:00:00Z'),
            timeOfBirth: '12:00',
            birthTimeKnown: true,
            latitude,
            longitude: 0,
            timezone: 0,
            location: 'Synthetic polar fixture',
          }),
        },
      };
      const validation = service as unknown as {
        birth(tx: unknown, customer: string): Promise<unknown>;
      };
      await expect(validation.birth(tx, 'synthetic')).rejects.toThrow(
        'No alternate house system',
      );
      expect(engine.generate).not.toHaveBeenCalled();
    },
  );
  const oldEnabled = process.env.KUNDLI_CONSENT_V1_ENABLED,
    oldPolicy = process.env.KUNDLI_CONSENT_POLICY_APPROVED;
  afterEach(() => {
    if (oldEnabled === undefined) delete process.env.KUNDLI_CONSENT_V1_ENABLED;
    else process.env.KUNDLI_CONSENT_V1_ENABLED = oldEnabled;
    if (oldPolicy === undefined)
      delete process.env.KUNDLI_CONSENT_POLICY_APPROVED;
    else process.env.KUNDLI_CONSENT_POLICY_APPROVED = oldPolicy;
  });
  it.each([
    {},
    { KUNDLI_CONSENT_V1_ENABLED: 'true' },
    {
      KUNDLI_CONSENT_V1_ENABLED: 'true',
      KUNDLI_CONSENT_POLICY_APPROVED: 'unapproved',
    },
  ])(
    'fails closed before database access with incomplete activation %j',
    async (env) => {
      delete process.env.KUNDLI_CONSENT_V1_ENABLED;
      delete process.env.KUNDLI_CONSENT_POLICY_APPROVED;
      Object.assign(process.env, env);
      const tx = jest.fn();
      const service = new ConsultationKundliV1Service(
        { $transaction: tx } as never,
        {} as never,
      );
      await expect(service.status('synthetic', 'synthetic')).rejects.toThrow(
        'not activated',
      );
      expect(tx).not.toHaveBeenCalled();
    },
  );
  it('requires canonical authentication before calling a service', () => {
    const service = { status: jest.fn() };
    const controller = new ConsultationKundliV1Controller(service as never);
    expect(() => controller.status({}, 'synthetic')).toThrow('authentication');
    expect(service.status).not.toHaveBeenCalled();
  });
  it('forwards only the verified guard token deadline to generation', () => {
    const service = { generate: jest.fn() };
    const controller = new ConsultationKundliV1Controller(service as never);
    void controller.generate({ sub: 'synthetic', exp: 123 }, 'call', {
      requestKey: 'key',
    });
    expect(service.generate).toHaveBeenCalledWith(
      'synthetic',
      'call',
      'key',
      'en',
      123,
    );
  });
  it('forwards signed portal context for authoritative action availability', () => {
    const service = { status: jest.fn() };
    const controller = new ConsultationKundliV1Controller(service as never);
    void controller.status(
      { sub: 'synthetic', asp_context: 'customer' },
      'call',
    );
    expect(service.status).toHaveBeenCalledWith(
      'synthetic',
      'call',
      'customer',
    );
  });
  it('rejects an expired credential before opening a transaction', async () => {
    process.env.KUNDLI_CONSENT_V1_ENABLED = 'true';
    process.env.KUNDLI_CONSENT_POLICY_APPROVED = 'kundli-local-v1';
    const transaction = jest.fn();
    const service = new ConsultationKundliV1Service(
      { $transaction: transaction } as never,
      {} as never,
    );
    await expect(
      service.generate('synthetic', 'call', 'key', 'en', 1),
    ).rejects.toThrow('Authentication expired');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('does not register the new controller in the running Kundli module', () => {
    const source = readFileSync(join(__dirname, 'kundli.module.ts'), 'utf8');
    expect(source).not.toContain('ConsultationKundliV1Controller');
    expect(
      Reflect.getMetadata('__guards__', ConsultationKundliV1Controller),
    ).toHaveLength(1);
  });
});
