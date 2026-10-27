import { ForbiddenException } from '@nestjs/common';

// Proposed contract; not an activated consent policy.
export const KUNDLI_CONSENT_POLICY_VERSION = 'kundli-local-v1';
export const KUNDLI_BIRTH_DATA_SCOPE = [
  'dob',
  'timeOfBirth',
  'latitude',
  'longitude',
  'timezone',
  'birthPlace',
] as const;

// Internal, server-resolved references. Never bind these directly from a DTO.
export type KundliConsentContext = Readonly<{
  consultationId: string;
  customerUserId: string;
  astrologerUserId: string;
  birthDataVersion: string;
  consultationStatus: string;
  consultationExpiresAt: Date;
  consultationEndedAt: Date | null;
}>;

export type StoredKundliConsent = Pick<
  KundliConsentContext,
  'consultationId' | 'customerUserId' | 'astrologerUserId' | 'birthDataVersion'
> &
  Readonly<{
    purpose: 'LOCAL_KUNDLI_CALCULATION';
    grantedAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    policyVersion: string;
    fieldScope: readonly string[];
    grantedByUserId: string;
  }>;

// A future adapter must read customer-granted durable evidence, not a flag
// supplied by the astrologer. No production adapter exists or is registered.
export interface KundliConsentSource {
  findCurrent(
    context: KundliConsentContext,
  ): Promise<StoredKundliConsent | null>;
}

class UnconfiguredConsentSource implements KundliConsentSource {
  async findCurrent(): Promise<null> {
    return null;
  }
}

/** Fail-closed foundation only: no controller/module registration or generation. */
export class KundliGenerationConsentGate {
  constructor(
    private readonly source: KundliConsentSource = new UnconfiguredConsentSource(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async assertAllowed(context: KundliConsentContext): Promise<void> {
    const deny = () =>
      new ForbiddenException({
        code: 'KUNDLI_CUSTOMER_CONSENT_REQUIRED',
        message:
          'Current customer authorization for this consultation and birth data is required',
      });
    if (
      [
        context.consultationId,
        context.customerUserId,
        context.astrologerUserId,
        context.birthDataVersion,
      ].some((value) => typeof value !== 'string' || !value.trim())
    ) {
      throw deny();
    }
    const beforeLookup = this.clock().getTime();
    if (
      context.consultationStatus !== 'ACTIVE' ||
      context.consultationEndedAt !== null ||
      !(context.consultationExpiresAt instanceof Date) ||
      !Number.isFinite(context.consultationExpiresAt.getTime()) ||
      !Number.isFinite(beforeLookup) ||
      context.consultationExpiresAt.getTime() <= beforeLookup
    ) {
      throw deny();
    }
    let consent: StoredKundliConsent | null;
    try {
      consent = await this.source.findCurrent(context);
    } catch {
      // No raw adapter error, birth data, identity or credentials in diagnostics.
      throw deny();
    }
    const now = this.clock().getTime();
    if (
      !Number.isFinite(now) ||
      !consent ||
      consent.consultationId !== context.consultationId ||
      consent.customerUserId !== context.customerUserId ||
      consent.astrologerUserId !== context.astrologerUserId ||
      consent.birthDataVersion !== context.birthDataVersion ||
      consent.purpose !== 'LOCAL_KUNDLI_CALCULATION' ||
      consent.grantedByUserId !== context.customerUserId ||
      consent.policyVersion !== KUNDLI_CONSENT_POLICY_VERSION ||
      !Array.isArray(consent.fieldScope) ||
      consent.fieldScope.length !== KUNDLI_BIRTH_DATA_SCOPE.length ||
      KUNDLI_BIRTH_DATA_SCOPE.some(
        (field) => !consent.fieldScope.includes(field),
      ) ||
      consent.revokedAt !== null ||
      !(consent.grantedAt instanceof Date) ||
      !Number.isFinite(consent.grantedAt.getTime()) ||
      !(consent.expiresAt instanceof Date) ||
      !Number.isFinite(consent.expiresAt.getTime()) ||
      consent.grantedAt.getTime() > now ||
      consent.expiresAt.getTime() <= now ||
      context.consultationExpiresAt.getTime() <= now
    ) {
      throw deny();
    }
  }
}
