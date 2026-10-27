import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LocalVedicKundliProvider } from './providers/local-vedic-kundli.provider';
import {
  KundliGenerationConsentGate,
  KUNDLI_BIRTH_DATA_SCOPE,
  KUNDLI_CONSENT_POLICY_VERSION,
  StoredKundliConsent,
} from './kundli-generation-consent';
import { validateProfessionalKundliReport } from './professional-kundli-report.validator';
import { resolveIanaBirthTime } from '../../common/utils/iana-birth-time.util';

type Tx = Prisma.TransactionClient;
type Call = {
  id: string;
  userId: string;
  astrologerId: string;
  status: string;
  expiresAt: Date;
  endedAt: Date | null;
};
type Job = {
  id: string;
  consentId: string;
  lang: string;
  status: string;
  leaseToken: string;
  leaseExpiresAt: Date;
  savedRecordId: string | null;
};
const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Prepared only. No module registration; both activation settings default off. */
@Injectable()
export class ConsultationKundliV1Service {
  constructor(
    private readonly db: PrismaService,
    private readonly engine: LocalVedicKundliProvider,
  ) {}

  private enabled() {
    if (
      process.env.KUNDLI_CONSENT_V1_ENABLED !== 'true' ||
      process.env.KUNDLI_CONSENT_POLICY_APPROVED !==
        KUNDLI_CONSENT_POLICY_VERSION
    ) {
      throw new ServiceUnavailableException(
        'Consultation Kundli consent and generation are not activated',
      );
    }
  }
  private credentialCurrent(expiresAt?: number) {
    // HTTP guard supplies the verified JWT deadline. Internal synthetic callers
    // may omit it; client request bodies never control this value.
    if (
      expiresAt !== undefined &&
      (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000)
    )
      throw new UnauthorizedException('Authentication expired');
  }
  private transaction<T>(work: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 2000,
      timeout: 5000,
    });
  }
  private async now(tx: Tx) {
    return (
      await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`
    )[0].now;
  }
  private async context(
    tx: Tx,
    subject: string,
    callId: string,
    customerOnly = false,
    requireAvailableParticipants = true,
  ) {
    const actor = await tx.user.findUnique({
      where: { supabaseId: subject },
      select: { id: true, isActive: true, isBlocked: true },
    });
    if (!actor?.isActive || actor.isBlocked)
      throw new ForbiddenException('Active canonical account required');
    // Shared lock order for grant/revoke/reserve/publication: consultation -> users -> entitlement -> consent -> request.
    const call = (
      await tx.$queryRaw<
        Call[]
      >`SELECT "id","userId","astrologerId","status","expiresAt","endedAt" FROM public."CallSession" WHERE "id"=${callId} FOR UPDATE`
    )[0];
    if (
      !call ||
      (actor.id !== call.userId &&
        (customerOnly || actor.id !== call.astrologerId))
    )
      throw new ForbiddenException('Consultation access denied');
    await tx.$queryRaw`SELECT "id" FROM public."User" WHERE "id" IN (${call.userId},${call.astrologerId}) ORDER BY "id" FOR UPDATE`;
    const participants = await tx.user.count({
      where: {
        id: { in: [call.userId, call.astrologerId] },
        isActive: true,
        isBlocked: false,
      },
    });
    if (requireAvailableParticipants && participants !== 2)
      throw new ForbiddenException('Consultation participant unavailable');
    return { actor, call, now: await this.now(tx) };
  }
  private active(call: Call, now: Date) {
    if (call.status !== 'ACTIVE' || call.endedAt || call.expiresAt <= now)
      throw new ForbiddenException('Active consultation required');
  }
  private async entitled(tx: Tx, call: Call, now: Date) {
    const account = await tx.user.findUnique({
      where: { id: call.astrologerId },
      select: { isAstrologer: true, isActive: true, isBlocked: true },
    });
    if (!account?.isAstrologer || !account.isActive || account.isBlocked)
      throw new ForbiddenException('Approved astrologer account required');
    await tx.$queryRaw`SELECT "id" FROM public."Astrologer" WHERE "userId"=${call.astrologerId} FOR UPDATE`;
    const astrologer = await tx.astrologer.findUnique({
      where: { userId: call.astrologerId },
      select: { id: true, isApproved: true, isVerified: true },
    });
    if (!astrologer?.isApproved || !astrologer.isVerified)
      throw new ForbiddenException('Approved astrologer required');
    await tx.$queryRaw`SELECT s."id" FROM public."Subscription" s JOIN public."SubscriptionPlan" p ON p."id"=s."subscriptionPlanId" WHERE s."userId"=${call.astrologerId} AND p."name"='ASTROLOGER_KUNDLI_YEARLY' ORDER BY s."id" FOR UPDATE OF s,p`;
    const subscription = await tx.subscription.findFirst({
      where: {
        userId: call.astrologerId,
        amount: 3500,
        currency: 'INR',
        subscriptionStatus: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gt: now },
        subscriptionPlan: {
          name: 'ASTROLOGER_KUNDLI_YEARLY',
          price: 3500,
          currency: 'INR',
          durationDays: 365,
          isActive: true,
        },
      },
      include: { subscriptionPlan: true },
    });
    const features = subscription?.subscriptionPlan?.features as Record<
      string,
      unknown
    > | null;
    if (
      !subscription ||
      features?.unlimitedKundliGeneration === false ||
      features?.detailedKundliReports === false
    )
      throw new ForbiddenException(
        'Active professional Kundli entitlement required',
      );
    return { astrologerId: astrologer.id, validUntil: subscription.endDate };
  }
  private async birth(tx: Tx, customerId: string) {
    await tx.$queryRaw`SELECT "id" FROM public."UserProfile" WHERE "userId"=${customerId} FOR SHARE`;
    const p = await tx.userProfile.findUnique({
      where: { userId: customerId },
      select: {
        dateOfBirth: true,
        timeOfBirth: true,
        birthTimeKnown: true,
        latitude: true,
        longitude: true,
        timezone: true,
        timezoneName: true,
        location: true,
        city: true,
      },
    });
    if (
      !p?.dateOfBirth ||
      !p.birthTimeKnown ||
      !p.timeOfBirth ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(p.timeOfBirth)
    )
      throw new BadRequestException(
        'Complete customer-authorized birth details required',
      );
    const lat = p.latitude,
      lon = p.longitude,
      timezone = p.timezone;
    const place = (p.location || p.city || '').trim();
    if (
      !Number.isFinite(p.dateOfBirth.getTime()) ||
      p.dateOfBirth.getTime() > Date.now() ||
      place.length > 160
    )
      throw new BadRequestException('Valid customer birth details required');
    if (
      lat === null ||
      lon === null ||
      timezone === null ||
      ![lat, lon, timezone].every(Number.isFinite) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180 ||
      timezone < -12 ||
      timezone > 14 ||
      !place
    )
      throw new BadRequestException(
        'Valid birth location and timezone required',
      );
    // Match the existing KP provider's supported range before reserving work.
    // Never hide an unsupported latitude behind a generic calculation503 or
    // silently substitute another house system.
    if (lat <= -66.5 || lat >= 66.5)
      throw new BadRequestException(
        'This local Kundli engine requires birth latitude between -66.5 and 66.5 degrees for KP reports. No alternate house system will be substituted.',
      );
    const params = {
      dob: p.dateOfBirth.toISOString().slice(0, 10),
      tob: p.timeOfBirth.length === 5 ? p.timeOfBirth + ':00' : p.timeOfBirth,
      lat,
      lon,
      timezone,
    };
    if (p.timezoneName) {
      try {
        params.timezone = resolveIanaBirthTime(
          params.dob,
          params.tob,
          p.timezoneName,
        ).offsetHours;
      } catch {
        throw new BadRequestException(
          'Birth time or IANA timezone is invalid or ambiguous. Confirm the birth location and historical time.',
        );
      }
    }
    return {
      params,
      place,
      version: digest({
        ...params,
        birthPlace: place,
        ...(p.timezoneName ? { timezoneName: p.timezoneName } : {}),
      }),
    };
  }
  private async consent(tx: Tx, call: Call) {
    return (
      (
        await tx.$queryRaw<
          Array<StoredKundliConsent & { id: string }>
        >`SELECT * FROM public."KundliGenerationConsent" WHERE "consultationId"=${call.id} AND "revokedAt" IS NULL ORDER BY "grantedAt" DESC LIMIT 1 FOR UPDATE`
      )[0] ?? null
    );
  }
  private async authorize(tx: Tx, call: Call, now: Date) {
    this.active(call, now);
    const entitlement = await this.entitled(tx, call, now);
    const consent = await this.consent(tx, call);
    await new KundliGenerationConsentGate(
      { findCurrent: () => Promise.resolve(consent) },
      () => now,
    ).assertAllowed({
      consultationId: call.id,
      customerUserId: call.userId,
      astrologerUserId: call.astrologerId,
      birthDataVersion: consent?.birthDataVersion ?? 'missing',
      consultationStatus: call.status,
      consultationExpiresAt: call.expiresAt,
      consultationEndedAt: call.endedAt,
    });
    // Read protected birth fields only after checking current consent.
    const birth = await this.birth(tx, call.userId);
    if (birth.version !== consent.birthDataVersion)
      throw new ForbiddenException(
        'Birth details changed; new customer consent required',
      );
    // Locks serialize mutation, but do not stop the clock. Authorize at the
    // final boundary after potentially waiting for entitlement/profile locks.
    const boundaryNow = await this.now(tx);
    this.active(call, boundaryNow);
    if (
      !entitlement.validUntil ||
      entitlement.validUntil <= boundaryNow ||
      consent.expiresAt <= boundaryNow
    )
      throw new ForbiddenException('Kundli authorization expired');
    return { consent, birth, astrologerId: entitlement.astrologerId };
  }
  async status(subject: string, callId: string, authContext?: string) {
    this.enabled();
    return this.transaction(async (tx) => {
      const { actor, call, now } = await this.context(
        tx,
        subject,
        callId,
        false,
        false,
      );
      const consent = await this.consent(tx, call);
      const participant = await tx.user.findUnique({
        where: { id: call.astrologerId },
        select: { name: true, userProfile: { select: { fullName: true } } },
      });
      const subscription = await tx.subscription.findFirst({
        where: {
          userId: call.astrologerId,
          subscriptionPlan: { name: 'ASTROLOGER_KUNDLI_YEARLY' },
        },
        orderBy: { createdAt: 'desc' },
        select: { subscriptionStatus: true, endDate: true },
      });
      const latest =
        consent ??
        (
          await tx.$queryRaw<
            Array<StoredKundliConsent & { id: string }>
          >`SELECT * FROM public."KundliGenerationConsent" WHERE "consultationId"=${call.id} ORDER BY "grantedAt" DESC LIMIT 1`
        )[0] ??
        null;
      let allowed = false;
      try {
        await this.authorize(tx, call, now);
        allowed = true;
      } catch (error) {
        if (
          !(
            error instanceof ForbiddenException ||
            error instanceof BadRequestException
          )
        )
          throw error;
      }
      return {
        success: true,
        data: {
          consultationId: call.id,
          astrologerName:
            participant?.name?.trim() ||
            participant?.userProfile?.fullName?.trim() ||
            null,
          consultationStatus: call.status,
          subscriptionStatus:
            actor.id === call.astrologerId
              ? subscription?.endDate && subscription.endDate <= now
                ? 'EXPIRED'
                : (subscription?.subscriptionStatus ?? 'MISSING')
              : undefined,
          subscriptionExpiresAt:
            actor.id === call.astrologerId
              ? (subscription?.endDate ?? null)
              : undefined,
          consentId: latest?.id ?? null,
          state:
            !consent && latest?.revokedAt
              ? 'REVOKED'
              : consent
                ? consent.expiresAt <= now
                  ? 'EXPIRED'
                  : allowed
                    ? 'GRANTED'
                    : 'UNAVAILABLE'
                : 'REQUIRED',
          canGenerate:
            actor.id === call.astrologerId &&
            allowed &&
            (authContext === undefined || authContext === 'astrologer'),
          canGrant:
            actor.id === call.userId &&
            (authContext === undefined || authContext === 'customer') &&
            call.status === 'ACTIVE' &&
            !call.endedAt &&
            call.expiresAt > now,
          canRevoke:
            actor.id === call.userId &&
            !!consent &&
            (authContext === undefined || authContext === 'customer'),
          policyVersion: KUNDLI_CONSENT_POLICY_VERSION,
          // This version supports only the authenticated customer's own primary
          // profile, never an arbitrary saved/family profile supplied by a caller.
          birthProfileSource: 'CUSTOMER_PRIMARY_PROFILE',
          fieldScope: KUNDLI_BIRTH_DATA_SCOPE,
          expiresAt: consent?.expiresAt ?? call.expiresAt,
        },
      };
    });
  }
  async grant(
    subject: string,
    callId: string,
    body: { accepted?: boolean; policyVersion?: string },
  ) {
    this.enabled();
    if (
      body?.accepted !== true ||
      body?.policyVersion !== KUNDLI_CONSENT_POLICY_VERSION
    )
      throw new BadRequestException(
        'Explicit acceptance of the current consent notice required',
      );
    await this.transaction(async (tx) => {
      const { call, now } = await this.context(tx, subject, callId, true);
      this.active(call, now);
      await this.entitled(tx, call, now);
      const birth = await this.birth(tx, call.userId);
      const existing = await this.consent(tx, call);
      if (
        existing &&
        existing.birthDataVersion === birth.version &&
        existing.policyVersion === KUNDLI_CONSENT_POLICY_VERSION &&
        existing.grantedByUserId === call.userId &&
        existing.purpose === 'LOCAL_KUNDLI_CALCULATION' &&
        existing.fieldScope.length === KUNDLI_BIRTH_DATA_SCOPE.length &&
        KUNDLI_BIRTH_DATA_SCOPE.every((field) =>
          existing.fieldScope.includes(field),
        ) &&
        existing.expiresAt > now
      )
        return;
      if (existing)
        await tx.$executeRaw`UPDATE public."KundliGenerationConsent" SET "revokedAt"=clock_timestamp() WHERE "id"=${existing.id} AND "revokedAt" IS NULL`;
      await tx.$executeRaw`INSERT INTO public."KundliGenerationConsent" ("id","consultationId","customerUserId","astrologerUserId","grantedByUserId","birthDataVersion","purpose","policyVersion","fieldScope","expiresAt") VALUES (${randomUUID()},${call.id},${call.userId},${call.astrologerId},${call.userId},${birth.version},'LOCAL_KUNDLI_CALCULATION',${KUNDLI_CONSENT_POLICY_VERSION},${[...KUNDLI_BIRTH_DATA_SCOPE]}::text[],${call.expiresAt})`;
    });
    return this.status(subject, callId);
  }
  async revoke(subject: string, callId: string) {
    this.enabled();
    await this.transaction(async (tx) => {
      const { call } = await this.context(tx, subject, callId, true, false);
      await tx.$executeRaw`UPDATE public."KundliGenerationConsent" SET "revokedAt"=clock_timestamp() WHERE "consultationId"=${call.id} AND "customerUserId"=${call.userId} AND "revokedAt" IS NULL`;
    });
    return {
      success: true,
      data: { state: 'REVOKED', canGenerate: false, canRevoke: false },
    };
  }
  async generate(
    subject: string,
    callId: string,
    requestKey: string,
    lang = 'en',
    credentialExpiresAt?: number,
  ) {
    this.enabled();
    this.credentialCurrent(credentialExpiresAt);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        requestKey,
      ) ||
      !['en', 'hi'].includes(lang)
    )
      throw new BadRequestException(
        'Valid request key and supported report language required',
      );
    const reservation = await this.transaction(async (tx) => {
      const { actor, call, now } = await this.context(tx, subject, callId);
      if (actor.id !== call.astrologerId)
        throw new ForbiddenException('Astrologer access required');
      const authorization = await this.authorize(tx, call, now);
      const job = (
        await tx.$queryRaw<
          Job[]
        >`SELECT * FROM public."KundliGenerationRequest" WHERE "actorUserId"=${actor.id} AND "consultationId"=${call.id} AND "requestKey"=${requestKey} FOR UPDATE`
      )[0];
      if (
        job &&
        (job.consentId !== authorization.consent.id || job.lang !== lang)
      )
        throw new ConflictException(
          'Request key belongs to different authorization or language',
        );
      if (job?.status === 'PUBLISHED')
        return {
          ...authorization,
          call,
          id: job.id,
          leaseToken: job.leaseToken,
          savedRecordId: job.savedRecordId,
        };
      if (job && job.leaseExpiresAt > now)
        throw new ConflictException('Generation is already processing');
      const busy = (
        await tx.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT count(*) FROM public."KundliGenerationRequest" WHERE "actorUserId"=${actor.id} AND "status"='RESERVED' AND "leaseExpiresAt">${now}`
      )[0];
      if (Number(busy.count) > 0)
        throw new HttpException(
          'Another calculation is processing; retry later',
          429,
        );
      const recent = await tx.kundliGenerationRequest.count({
        where: {
          actorUserId: actor.id,
          createdAt: { gt: new Date(now.getTime() - 60000) },
        },
      });
      if (!job && recent >= 30)
        throw new HttpException(
          'Calculation requests are too frequent; retry later',
          429,
        );
      const id = job?.id ?? randomUUID(),
        leaseToken = randomUUID(),
        leaseExpiresAt = new Date(now.getTime() + 60000);
      if (job)
        await tx.$executeRaw`UPDATE public."KundliGenerationRequest" SET "leaseToken"=${leaseToken},"leaseExpiresAt"=${leaseExpiresAt} WHERE "id"=${id}`;
      else
        await tx.$executeRaw`INSERT INTO public."KundliGenerationRequest" ("id","actorUserId","consultationId","requestKey","consentId","lang","leaseToken","leaseExpiresAt","status") VALUES (${id},${actor.id},${call.id},${requestKey},${authorization.consent.id},${lang},${leaseToken},${leaseExpiresAt},'RESERVED')`;
      return { ...authorization, call, id, leaseToken, savedRecordId: null };
    });
    if (reservation.savedRecordId) {
      this.credentialCurrent(credentialExpiresAt);
      return {
        success: true,
        data: { savedRecordId: reservation.savedRecordId, replay: true },
      };
    }
    try {
      const report = await this.engine.generate(reservation.birth.params, lang);
      if (!validateProfessionalKundliReport(report).valid)
        throw new ServiceUnavailableException(
          'Local calculation did not produce a complete report',
        );
      const savedRecordId = await this.transaction(async (tx) => {
        const { call, now } = await this.context(tx, subject, callId);
        const current = await this.authorize(tx, call, now);
        const job = (
          await tx.$queryRaw<
            Job[]
          >`SELECT * FROM public."KundliGenerationRequest" WHERE "id"=${reservation.id} FOR UPDATE`
        )[0];
        if (
          current.consent.id !== reservation.consent.id ||
          current.birth.version !== reservation.birth.version ||
          !job ||
          job.status !== 'RESERVED' ||
          job.leaseToken !== reservation.leaseToken ||
          job.leaseExpiresAt <= now
        )
          throw new ConflictException(
            'Generation authorization or reservation changed',
          );
        this.credentialCurrent(credentialExpiresAt);
        const kundli = await tx.kundli.create({
          data: {
            ...{
              dob: current.birth.params.dob,
              tob: current.birth.params.tob,
              latitude: current.birth.params.lat,
              longitude: current.birth.params.lon,
              timezone: current.birth.params.timezone,
            },
            hash: digest(['consultation-local-v1', job.id]),
            data: {
              create: {
                lang,
                vedic: report as unknown as Prisma.InputJsonValue,
                apiVersion: 'consented-local-v1',
              },
            },
          },
        });
        const saved = await tx.kundliSavedRecord.create({
          data: {
            kundliId: kundli.id,
            createdByAstrologerId: current.astrologerId,
            customerUserId: call.userId,
            name: 'Consultation Kundli',
            birthPlace: current.birth.place,
            lang,
            idempotencyKey: digest(['consultation-local-v1', job.id]),
          },
        });
        await tx.$executeRaw`UPDATE public."KundliGenerationRequest" SET "status"='PUBLISHED',"savedRecordId"=${saved.id} WHERE "id"=${job.id} AND "leaseToken"=${reservation.leaseToken}`;
        return saved.id;
      });
      return { success: true, data: { savedRecordId, replay: false } };
    } catch (error) {
      // Release only this attempt's lease; no auto retry and no private exception logs.
      await this.db
        .$executeRaw`UPDATE public."KundliGenerationRequest" SET "leaseExpiresAt"=clock_timestamp() WHERE "id"=${reservation.id} AND "leaseToken"=${reservation.leaseToken} AND "status"='RESERVED'`.catch(
        () => undefined,
      );
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Kundli calculation could not be completed; retry safely with the same request key',
      );
    }
  }
}
