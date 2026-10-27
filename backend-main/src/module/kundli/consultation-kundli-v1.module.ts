import { DynamicModule, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { ConsultationKundliAuthGuard } from './guards/consultation-kundli-auth.guard';
import { ConsultationKundliV1Controller } from './consultation-kundli-v1.controller';
import { ConsultationKundliV1Service } from './consultation-kundli-v1.service';
import { LocalVedicKundliProvider } from './providers/local-vedic-kundli.provider';
import { KUNDLI_CONSENT_POLICY_VERSION } from './kundli-generation-consent';

/** PREPARED ONLY. Do not import into AppModule until migration/policy/activation approval. */
@Module({})
export class ConsultationKundliV1Module {
  /** Prepared integration API only; still not imported by any running module.
   * Both existing approval gates are required even to register routes/providers.
   * Service guards recheck the gates on requests; schema approval is separate.
   */
  static registerIfApproved(
    env: NodeJS.ProcessEnv = process.env,
  ): DynamicModule {
    if (
      env.KUNDLI_CONSENT_V1_ENABLED !== 'true' ||
      env.KUNDLI_CONSENT_POLICY_APPROVED !== KUNDLI_CONSENT_POLICY_VERSION
    ) {
      return { module: ConsultationKundliV1Module };
    }
    return {
      module: ConsultationKundliV1Module,
      imports: [PrismaModule, SupabaseModule],
      controllers: [ConsultationKundliV1Controller],
      providers: [
        ConsultationKundliV1Service,
        ConsultationKundliAuthGuard,
        LocalVedicKundliProvider,
      ],
    };
  }
}
