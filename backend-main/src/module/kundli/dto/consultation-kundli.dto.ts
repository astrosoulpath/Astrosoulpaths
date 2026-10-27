import { Equals, IsIn, IsOptional, IsUUID } from 'class-validator';
import { KUNDLI_CONSENT_POLICY_VERSION } from '../kundli-generation-consent';

// Client cannot supply a customer, astrologer, birth profile or entitlement.
export class GrantConsultationKundliDto {
  @Equals(true)
  accepted!: boolean;

  @Equals(KUNDLI_CONSENT_POLICY_VERSION)
  policyVersion!: string;
}

export class GenerateConsultationKundliDto {
  @IsUUID()
  requestKey!: string;

  @IsOptional()
  @IsIn(['en', 'hi'])
  lang?: string;
}
