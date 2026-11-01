import {
  backgroundScheduleOptions,
  maintenanceJobEnabled,
} from './background-job-gates';
import { AiAstroExpiryProcessor } from '../module/ai-astro/ai-astro-expiry.processor';
import { ConsultationExpiryProcessor } from '../module/consultation/consultation-expiry.processor';
import { EarningReleaseProcessor } from '../module/consultation/earning-release.processor';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AiAstroService } from '../module/ai-astro/ai-astro.service';
import { ConsultationService } from '../module/consultation/consultation.service';

jest.mock('../module/ai-astro/ai-astro.service', () => ({
  AiAstroService: class {},
}));
jest.mock('../module/consultation/consultation.service', () => ({
  ConsultationService: class {},
}));
jest.mock('../infrastructure/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

describe('default-off maintenance (no database/network)', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
  });
  it.each([undefined, 'false', 'TRUE', '1'])(
    'disables all Nest schedule registrations for %s',
    (value) => {
      expect(
        backgroundScheduleOptions({ BACKGROUND_JOBS_ENABLED: value }),
      ).toEqual({ cronJobs: false, intervals: false, timeouts: false });
    },
  );
  it('requires both explicit approvals', () => {
    expect(
      maintenanceJobEnabled('AI_EXPIRY', {
        MAINTENANCE_AI_EXPIRY_ENABLED: 'true',
      }),
    ).toBe(false);
    expect(
      maintenanceJobEnabled('AI_EXPIRY', { BACKGROUND_JOBS_ENABLED: 'true' }),
    ).toBe(false);
    expect(
      maintenanceJobEnabled('AI_EXPIRY', {
        BACKGROUND_JOBS_ENABLED: 'true',
        MAINTENANCE_AI_EXPIRY_ENABLED: 'true',
      }),
    ).toBe(true);
  });
  it.each([undefined, 'false', 'TRUE', '1'])(
    'disabled entrypoints do not even touch Prisma or services for %s',
    async (value) => {
      process.env = {
        ...original,
        BACKGROUND_JOBS_ENABLED: value,
        MAINTENANCE_AI_EXPIRY_ENABLED: 'true',
        MAINTENANCE_CONSULTATION_EXPIRY_ENABLED: 'true',
        MAINTENANCE_EARNINGS_RELEASE_ENABLED: 'true',
      };
      const access = jest.fn(() => {
        throw new Error('Unexpected database/service access');
      });
      const forbidden = new Proxy({}, { get: access });
      const prisma = forbidden as PrismaService;
      await new AiAstroExpiryProcessor(
        prisma,
        forbidden as AiAstroService,
      ).settleExpiredSessions();
      await new ConsultationExpiryProcessor(
        prisma,
        forbidden as ConsultationService,
      ).completeExpiredConsultations();
      await new EarningReleaseProcessor(prisma).releaseEligibleEarnings();
      expect(access).not.toHaveBeenCalled();
    },
  );
  it('master on with individual gates absent still performs no calls', async () => {
    process.env = { BACKGROUND_JOBS_ENABLED: 'true' };
    const access = jest.fn(() => {
      throw new Error('Unexpected access');
    });
    const forbidden = new Proxy({}, { get: access });
    await new AiAstroExpiryProcessor(
      forbidden as PrismaService,
      forbidden as AiAstroService,
    ).settleExpiredSessions();
    await new ConsultationExpiryProcessor(
      forbidden as PrismaService,
      forbidden as ConsultationService,
    ).completeExpiredConsultations();
    await new EarningReleaseProcessor(
      forbidden as PrismaService,
    ).releaseEligibleEarnings();
    expect(access).not.toHaveBeenCalled();
  });
  it('retains original query paths when explicitly enabled with synthetic empty work', async () => {
    process.env = {
      BACKGROUND_JOBS_ENABLED: 'true',
      MAINTENANCE_AI_EXPIRY_ENABLED: 'true',
      MAINTENANCE_CONSULTATION_EXPIRY_ENABLED: 'true',
      MAINTENANCE_EARNINGS_RELEASE_ENABLED: 'true',
    };
    const fake = {
      aiAstroSession: { findMany: jest.fn().mockResolvedValue([]) },
      callSession: { findMany: jest.fn().mockResolvedValue([]) },
      astrologerEarning: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    await new AiAstroExpiryProcessor(
      fake as unknown as PrismaService,
      {} as AiAstroService,
    ).settleExpiredSessions();
    await new ConsultationExpiryProcessor(
      fake as unknown as PrismaService,
      {} as ConsultationService,
    ).completeExpiredConsultations();
    await new EarningReleaseProcessor(
      fake as unknown as PrismaService,
    ).releaseEligibleEarnings();
    expect(fake.aiAstroSession.findMany).toHaveBeenCalled();
    expect(fake.callSession.findMany).toHaveBeenCalled();
    expect(fake.astrologerEarning.updateMany).toHaveBeenCalled();
  });
});
