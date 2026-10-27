import {
  KundliConsentContext,
  KundliGenerationConsentGate,
  StoredKundliConsent,
  KUNDLI_CONSENT_POLICY_VERSION,
  KUNDLI_BIRTH_DATA_SCOPE,
} from './kundli-generation-consent';

describe('unregistered Kundli consent foundation', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const context: KundliConsentContext = {
    consultationId: 'synthetic-consultation',
    customerUserId: 'synthetic-customer',
    astrologerUserId: 'synthetic-astrologer',
    birthDataVersion: 'synthetic-version',
    consultationStatus: 'ACTIVE',
    consultationExpiresAt: new Date(now.getTime() + 10000),
    consultationEndedAt: null,
  };
  const consent: StoredKundliConsent = {
    ...context,
    purpose: 'LOCAL_KUNDLI_CALCULATION',
    grantedAt: new Date(now.getTime() - 1000),
    expiresAt: new Date(now.getTime() + 1000),
    revokedAt: null,
    policyVersion: KUNDLI_CONSENT_POLICY_VERSION,
    fieldScope: KUNDLI_BIRTH_DATA_SCOPE,
    grantedByUserId: context.customerUserId,
  };
  it('denies without a configured consent store', async () => {
    await expect(
      new KundliGenerationConsentGate().assertAllowed(context),
    ).rejects.toMatchObject({
      response: { code: 'KUNDLI_CUSTOMER_CONSENT_REQUIRED' },
    });
  });
  it('accepts repeated synthetic trusted-store authorizations without a quota', async () => {
    const source = { findCurrent: jest.fn().mockResolvedValue(consent) };
    const gate = new KundliGenerationConsentGate(source, () => now);
    for (let i = 0; i < 25; i++)
      await expect(gate.assertAllowed(context)).resolves.toBeUndefined();
    expect(source.findCurrent).toHaveBeenCalledTimes(25);
  });
  it.each([
    { consultationId: 'foreign' },
    { customerUserId: 'foreign' },
    { astrologerUserId: 'foreign' },
    { birthDataVersion: 'changed' },
    { revokedAt: now },
    { expiresAt: now },
    { grantedAt: new Date(now.getTime() + 1) },
    { expiresAt: new Date(NaN) },
    { purpose: 'UNRELATED' },
    { policyVersion: 'unapproved-version' },
    { grantedByUserId: 'astrologer-cannot-consent-for-customer' },
    { fieldScope: ['dob'] },
    { fieldScope: [...KUNDLI_BIRTH_DATA_SCOPE, 'phone'] },
  ])('rejects mismatched, expired or revoked evidence %j', async (change) => {
    const gate = new KundliGenerationConsentGate(
      { findCurrent: jest.fn().mockResolvedValue({ ...consent, ...change }) },
      () => now,
    );
    await expect(gate.assertAllowed(context)).rejects.toMatchObject({
      response: { code: 'KUNDLI_CUSTOMER_CONSENT_REQUIRED' },
    });
  });
  it('fails closed on store failure without returning private exception text', async () => {
    const gate = new KundliGenerationConsentGate(
      {
        findCurrent: jest
          .fn()
          .mockRejectedValue(new Error('synthetic-private-value')),
      },
      () => now,
    );
    await expect(gate.assertAllowed(context)).rejects.toThrow(
      'Current customer authorization',
    );
  });
  it('rejects an empty server context before querying a consent store', async () => {
    const source = { findCurrent: jest.fn() };
    await expect(
      new KundliGenerationConsentGate(source).assertAllowed({
        ...context,
        birthDataVersion: '',
      }),
    ).rejects.toThrow();
    expect(source.findCurrent).not.toHaveBeenCalled();
  });
  it('rejects omitted context fields even if a caller violates the internal type', async () => {
    const source = { findCurrent: jest.fn() };
    await expect(
      new KundliGenerationConsentGate(source).assertAllowed(
        {} as KundliConsentContext,
      ),
    ).rejects.toThrow();
    expect(source.findCurrent).not.toHaveBeenCalled();
  });
  it.each([
    'PENDING',
    'COMPLETED',
    'ENDED',
    'CANCELLED',
    'REJECTED',
    'EXPIRED',
  ])('denies consultation state %s before consent lookup', async (status) => {
    const source = { findCurrent: jest.fn() };
    const gate = new KundliGenerationConsentGate(source, () => now);
    await expect(
      gate.assertAllowed({ ...context, consultationStatus: status }),
    ).rejects.toThrow();
    expect(source.findCurrent).not.toHaveBeenCalled();
  });
  it('checks expiry again when the consent-store lookup crosses the deadline', async () => {
    const times = [now, new Date(context.consultationExpiresAt.getTime())];
    const gate = new KundliGenerationConsentGate(
      {
        findCurrent: jest.fn().mockResolvedValue({
          ...consent,
          expiresAt: new Date(now.getTime() + 60000),
        }),
      },
      () => times.shift()!,
    );
    await expect(gate.assertAllowed(context)).rejects.toThrow();
  });
  it('does not cache grant authorization across revocation', async () => {
    const source = {
      findCurrent: jest
        .fn()
        .mockResolvedValueOnce(consent)
        .mockResolvedValueOnce({ ...consent, revokedAt: now }),
    };
    const gate = new KundliGenerationConsentGate(source, () => now);
    await expect(gate.assertAllowed(context)).resolves.toBeUndefined();
    await expect(gate.assertAllowed(context)).rejects.toThrow();
  });
});
