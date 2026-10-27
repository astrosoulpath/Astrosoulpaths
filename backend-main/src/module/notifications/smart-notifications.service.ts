import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { requireSmartSchema, smartId, smartSchemaEnabled, validateSmartContent } from './smart-notification-contract';
import { composeSmartAstrologyPreview } from './smart-astrology-composer';
import { SmartCategory } from './smart-astrology.catalog';
import { AstroParams } from '../../common/types/astro-params.type';
import { smartReminderCopy } from './smart-reminder-copy';
import { notificationLocalDate } from './notification-local-date';
import { smartInterpretationNotice, LOCALIZED_SMART_VERSION } from './smart-interpretation-localization';

@Injectable()
export class SmartNotificationsService {
  constructor(private readonly db: PrismaService, private readonly identities: NotificationsService) {}
  async user(subject: string) {
    const id = await this.identities.resolveInternalUserId(subject);
    const user = await this.db.user.findUnique({ where: { id }, select: { id: true, isActive: true, isBlocked: true, userProfile: { select: { lang: true } } } });
    if (!user?.isActive || user.isBlocked) throw new NotFoundException('Insight unavailable');
    return user;
  }
  async listCampaigns() {
    requireSmartSchema();
    return { success: true, data: await this.db.$queryRaw`SELECT "id","category","locale","title","body","state","revision","scheduledAt","expiresAt" FROM public."SmartNotificationCampaign" ORDER BY "createdAt" DESC LIMIT 100` };
  }
  async storageReadiness() {
    const required = ['SmartNotificationPolicy','SmartNotificationConsent','SmartNotificationCampaign','SmartNotificationInsight','SmartNotificationDelivery','SmartNotificationAudit','SmartNotificationOpen'];
    const rows = await this.db.$queryRaw<{tablename:string}[]>`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename LIKE 'SmartNotification%'`;
    const missingTables = required.filter(name => !rows.some(row => row.tablename === name));
    return {success:true,data:{schemaGateEnabled:smartSchemaEnabled(),tablesReady:missingTables.length===0,missingTables,deliveryGateConfigured:process.env.SMART_NOTIFICATIONS_DELIVERY_ENABLED==='true',automaticGateConfigured:process.env.SMART_ASTROLOGY_AUTOMATIC_ENABLED==='true',note:'Table presence is not approval of constraints, migration lineage, consent or delivery.'}};
  }
  async campaignStatus(id: string) {
    requireSmartSchema(); smartId(id);
    const [campaign] = await this.db.$queryRaw<any[]>`SELECT "id","state","revision","expiresAt","scheduledAt" FROM public."SmartNotificationCampaign" WHERE "id"=${id}`;
    if (!campaign) throw new NotFoundException('Campaign unavailable');
    const deliveries = await this.db.$queryRaw<any[]>`SELECT d."state",count(*)::int AS "count" FROM public."SmartNotificationDelivery" d JOIN public."SmartNotificationInsight" i ON i."id"=d."insightId" WHERE i."campaignId"=${id} GROUP BY d."state"`;
    const audit = await this.db.$queryRaw<any[]>`SELECT "action","createdAt" FROM public."SmartNotificationAudit" WHERE "objectId"=${id} ORDER BY "createdAt" DESC LIMIT 50`;
    const [views] = await this.db.$queryRaw<any[]>`SELECT count(*)::int AS "count" FROM public."SmartNotificationOpen" o JOIN public."SmartNotificationInsight" i ON i."id"=o."insightId" WHERE i."campaignId"=${id}`;
    return { success: true, data: { campaign, deliveries, audit, uniqueAuthorizedDetailViews:views.count, engagementTracking:process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED==='true'?'ENABLED':'DISABLED',providerAcceptanceIsNotDeviceDisplay: true } };
  }
  async markOpened(subject:string,id:string) {
    if (process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED!=='true') return {success:true,data:{recorded:false,reason:'TRACKING_DISABLED'}};
    await this.getInsight(subject,id); const user=await this.user(subject);
    return this.db.$transaction(async tx => {
      // Lock the mutable authorization rows through publication. A revoke,
      // account disable, locale change or policy pause cannot slip between
      // this check and the tracking insert. No birth values enter analytics.
      const [consent]=await tx.$queryRaw<any[]>`SELECT c."engagementGranted"
        FROM public."SmartNotificationInsight" i
        JOIN public."SmartNotificationConsent" c ON c."userId"=i."userId" AND c."category"=i."category"
        JOIN public."SmartNotificationPolicy" p ON p."category"=i."category"
        JOIN public."User" u ON u."id"=i."userId"
        JOIN public."UserProfile" f ON f."userId"=u."id"
        WHERE i."id"=${id} AND i."userId"=${user.id} AND u."isActive" AND NOT u."isBlocked"
        AND i."locale"=lower(trim(f."lang")) AND i."expiresAt">CURRENT_TIMESTAMP
        AND c."granted" AND c."expiresAt">CURRENT_TIMESTAMP AND c."version"=i."consentVersion"
        AND p."approved" AND p."enabled" AND p."entitlement"='FREE_APPROVED'
        AND i."locale"=ANY(p."languages") AND p."revision"=i."policyRevision"
        AND (i."provenance"<>'LOCAL_COMPUTED' OR c."birthUse")
        FOR SHARE OF c,p,u,f`;
      if (!consent?.engagementGranted) return {success:true,data:{recorded:false,reason:'USER_TRACKING_CONSENT_REQUIRED'}};
      // Campaign rows are locked separately: nullable outer joins cannot be locked.
      const campaigns=await tx.$queryRaw<any[]>`SELECT a."state" FROM public."SmartNotificationCampaign" a
        JOIN public."SmartNotificationInsight" i ON i."campaignId"=a."id"
        WHERE i."id"=${id} FOR SHARE OF a`;
      if (campaigns.some(c=>c.state!=='SCHEDULED')) return {success:true,data:{recorded:false,reason:'INSIGHT_UNAVAILABLE'}};
      await tx.$executeRaw`INSERT INTO public."SmartNotificationOpen" ("insightId","userId") VALUES (${id},${user.id}) ON CONFLICT ("insightId") DO NOTHING`;
      return {success:true,data:{recorded:true}};
    });
  }
  async createCampaign(actorId: string, input: { category: string; locale: string; title: string; body: string; expiresAt: string; requestId?: string }) {
    requireSmartSchema(); validateSmartContent(input);
    const expires = new Date(input.expiresAt);
    if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now() || expires.getTime() > Date.now() + 31 * 86400000)
      throw new BadRequestException('Campaign expiry must be within 31 days');
    const id = input.requestId === undefined ? randomUUID() : smartId(input.requestId);
    const saved = await this.db.$transaction(async tx => {
      // Policies are installed by a separately approved rollout, never inferred from an Admin draft.
      const policies = await tx.$queryRaw<any[]>`SELECT "category" FROM public."SmartNotificationPolicy" WHERE "category"=${input.category}`;
      if (!policies.length) throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'SMART_CATEGORY_NOT_INSTALLED',
        message: 'Category policy has not been installed',
      });
      const inserted = await tx.$executeRaw`INSERT INTO public."SmartNotificationCampaign" ("id","category","locale","title","body","createdBy","expiresAt") VALUES (${id},${input.category},${input.locale},${input.title.trim()},${input.body.trim()},${actorId},${expires}) ON CONFLICT ("id") DO NOTHING`;
      if (!inserted) {
        const [existing] = await tx.$queryRaw<any[]>`SELECT "id","category","locale","title","body","createdBy","expiresAt","state","revision" FROM public."SmartNotificationCampaign" WHERE "id"=${id} FOR SHARE`;
        if (!existing || existing.createdBy !== actorId || existing.category !== input.category || existing.locale !== input.locale || existing.title !== input.title.trim() || existing.body !== input.body.trim() || existing.expiresAt.getTime() !== expires.getTime())
          throw new ConflictException('Draft request changed; reload before retrying');
        return { id, state: existing.state, revision: existing.revision };
      }
      await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action") VALUES (${randomUUID()},${actorId},${id},'DRAFT_CREATED')`;
      return { id, state: 'DRAFT', revision: 1 };
    });
    return { success: true, data: saved };
  }
  async editDraft(actorId: string, id: string, input: { revision: number; category: string; locale: string; title: string; body: string; expiresAt: string }) {
    requireSmartSchema(); smartId(id); validateSmartContent(input);
    const expires = new Date(input.expiresAt);
    if (!Number.isInteger(input.revision) || input.revision < 1 || !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now() || expires.getTime() > Date.now() + 31 * 86400000)
      throw new BadRequestException('Valid draft revision and expiry within 31 days required');
    return this.db.$transaction(async tx => {
      const [draft] = await tx.$queryRaw<any[]>`SELECT "state","revision" FROM public."SmartNotificationCampaign" WHERE "id"=${id} FOR UPDATE`;
      if (!draft || draft.state !== 'DRAFT' || draft.revision !== input.revision) throw new ConflictException('Only the current draft revision can be edited');
      const policies = await tx.$queryRaw<any[]>`SELECT "category" FROM public."SmartNotificationPolicy" WHERE "category"=${input.category}`;
      if (!policies.length) throw new ServiceUnavailableException({statusCode:503,code:'SMART_CATEGORY_NOT_INSTALLED',message:'Category policy has not been installed'});
      await tx.$executeRaw`UPDATE public."SmartNotificationCampaign" SET "category"=${input.category},"locale"=${input.locale},"title"=${input.title.trim()},"body"=${input.body.trim()},"expiresAt"=${expires},"revision"="revision"+1 WHERE "id"=${id}`;
      await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action","details") VALUES (${randomUUID()},${actorId},${id},'DRAFT_EDITED',${JSON.stringify({revision:input.revision+1})}::jsonb)`;
      return {success:true,data:{id,state:'DRAFT',revision:input.revision+1}};
    });
  }
  async transition(actorId: string, id: string, input: { action: string; revision: number; scheduledAt?: string; contentPolicyReviewed?:boolean }) {
    requireSmartSchema(); smartId(id);
    if (!input || !Number.isInteger(input.revision) || input.revision < 1 || !['approve','schedule','pause','cancel'].includes(input.action)) throw new BadRequestException('Invalid campaign transition');
    return this.db.$transaction(async tx => {
      const [campaign] = await tx.$queryRaw<any[]>`SELECT * FROM public."SmartNotificationCampaign" WHERE "id"=${id} FOR UPDATE`;
      if (!campaign || campaign.revision !== input.revision) throw new ConflictException('Campaign revision changed');
      let state: string; let scheduled: Date | null = null;
      if (input.action === 'approve') {
        if (campaign.state !== 'DRAFT' || campaign.expiresAt <= new Date()) throw new ConflictException('Only current drafts can be approved');
        if (input.contentPolicyReviewed!==true) throw new BadRequestException('Explicit editorial safety review required');
        validateSmartContent(campaign); state = 'APPROVED';
      } else if (input.action === 'schedule') {
        scheduled = new Date(input.scheduledAt ?? '');
        if (campaign.state !== 'APPROVED' || !Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now() || scheduled >= campaign.expiresAt)
          throw new ConflictException('Approved campaign and future schedule before expiry required');
        state = 'SCHEDULED';
      } else { if (campaign.state === 'PAUSED') return { success: true, data: { id, state: 'PAUSED' } }; state = 'PAUSED'; }
      await tx.$executeRaw`UPDATE public."SmartNotificationCampaign" SET "state"=${state},"revision"="revision"+1,"approvedBy"=CASE WHEN ${input.action}='approve' THEN ${actorId} ELSE "approvedBy" END,"scheduledAt"=COALESCE(${scheduled},"scheduledAt") WHERE "id"=${id}`;
      await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action","details") VALUES (${randomUUID()},${actorId},${id},${input.action==='cancel'?'CANCELLED':state},${JSON.stringify(input.action==='approve'?{contentPolicyReviewed:true,checklistVersion:'smart-editorial-safety-v1'}:{})}::jsonb)`;
      return { success: true, data: { id, state, revision: campaign.revision + 1 } };
    });
  }
  async setConsent(subject: string, category: string, input: { granted: boolean; birthUse: boolean; timezone: string; expiresAt: string; engagementGranted?:boolean }) {
    requireSmartSchema();
    if (!input || typeof input.granted !== 'boolean') throw new BadRequestException('Explicit consent is required');
    if (input.granted && process.env.SMART_NOTIFICATIONS_CONSENT_POLICY_APPROVED !== 'true') throw new ServiceUnavailableException('Smart consent policy is not approved');
    const user = await this.user(subject);
    // Revocation never needs a new expiry, birth-data grant or enabled grant policy.
    if (!input.granted) {
      await this.db.$transaction(async tx => {
        const changed = await tx.$executeRaw`UPDATE public."SmartNotificationConsent" SET "granted"=false,"birthUse"=false,"engagementGranted"=false,"version"="version"+1 WHERE "userId"=${user.id} AND "category"=${category} AND "granted"`;
        if (changed) {
          const [consent] = await tx.$queryRaw<any[]>`SELECT "version" FROM public."SmartNotificationConsent" WHERE "userId"=${user.id} AND "category"=${category}`;
          await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action","details") VALUES (${randomUUID()},${user.id},${category},'CONSENT_REVOKED',${JSON.stringify({version:consent.version,granted:false})}::jsonb)`;
        }
      });
      return { success: true, data: { category, granted: false } };
    }
    if (typeof input.birthUse !== 'boolean') throw new BadRequestException('Explicit birth-data purpose decision required');
    if (input.engagementGranted!==undefined && typeof input.engagementGranted!=='boolean') throw new BadRequestException('Explicit tracking consent required');
    const engagement=input.engagementGranted===true;
    if (engagement && process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED!=='true') throw new ServiceUnavailableException('Engagement privacy policy is not approved');
    const expires = new Date(input.expiresAt);
    if (!Number.isFinite(expires.getTime()) || expires <= new Date() || expires.getTime() > Date.now()+365*86400000) throw new BadRequestException('Invalid consent expiry');
    try { notificationLocalDate(input.timezone); } catch { throw new BadRequestException('Invalid timezone'); }
    await this.db.$transaction(async tx => {
      const [policy] = await tx.$queryRaw<any[]>`SELECT "approved" FROM public."SmartNotificationPolicy" WHERE "category"=${category} FOR SHARE`;
      if (!policy?.approved && input.granted) throw new ServiceUnavailableException('Category policy is not approved');
      await tx.$executeRaw`INSERT INTO public."SmartNotificationConsent" ("userId","category","granted","birthUse","engagementGranted","expiresAt","timezone") VALUES (${user.id},${category},${input.granted},${input.birthUse},${engagement},${expires},${input.timezone}) ON CONFLICT ("userId","category") DO UPDATE SET "version"="SmartNotificationConsent"."version"+1,"granted"=${input.granted},"birthUse"=${input.birthUse},"engagementGranted"=${engagement},"expiresAt"=${expires},"timezone"=${input.timezone}`;
      const [consent] = await tx.$queryRaw<any[]>`SELECT "version" FROM public."SmartNotificationConsent" WHERE "userId"=${user.id} AND "category"=${category}`;
      await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action","details") VALUES (${randomUUID()},${user.id},${category},'CONSENT_GRANTED',${JSON.stringify({version:consent.version,granted:true,birthUse:input.birthUse,engagementGranted:engagement,expiresAt:expires.toISOString(),timezone:input.timezone,purpose:input.birthUse?'NATAL_CATEGORY_INSIGHT':'EDITORIAL_CATEGORY'})}::jsonb)`;
    });
    return { success: true, data: { category, granted: input.granted } };
  }
  async getInsight(subject: string, id: string) {
    requireSmartSchema(); smartId(id); const user = await this.user(subject);
    const [row] = await this.db.$queryRaw<any[]>`SELECT i."id",i."category",i."locale",i."title",i."body",i."provenance",i."factors",i."createdAt",i."expiresAt"
      FROM public."SmartNotificationInsight" i JOIN public."SmartNotificationConsent" c ON c."userId"=i."userId" AND c."category"=i."category"
      JOIN public."SmartNotificationPolicy" p ON p."category"=i."category"
      LEFT JOIN public."SmartNotificationCampaign" a ON a."id"=i."campaignId"
      WHERE i."id"=${id} AND i."userId"=${user.id} AND i."locale"=${user.userProfile?.lang?.trim().toLowerCase() ?? ''}
      AND i."expiresAt">CURRENT_TIMESTAMP AND c."granted" AND c."expiresAt">CURRENT_TIMESTAMP AND c."version"=i."consentVersion"
      AND p."approved" AND p."enabled" AND i."locale"=ANY(p."languages") AND p."entitlement"='FREE_APPROVED' AND p."revision"=i."policyRevision"
      AND (i."provenance"<>'LOCAL_COMPUTED' OR c."birthUse") AND (i."campaignId" IS NULL OR a."state"='SCHEDULED')`;
    if (!row) throw new NotFoundException('Insight unavailable');
    return { success: true, data: { ...row, date: row.createdAt.toISOString().slice(0,10), advice: '', source: row.provenance, interpretationNotice: smartInterpretationNotice(row.locale) } };
  }
  /** Internal only: callers must supply birth data from a separately authorized
   * profile pipeline. No HTTP route accepts customer birth data for this method. */
  async prepareComputed(subject: string, category: SmartCategory, params: AstroParams) {
    requireSmartSchema(); const user = await this.user(subject);
    const locale = user.userProfile?.lang?.trim().toLowerCase() ?? '';
    // Composer enforces supported rules/locale and its own default-off guard.
    return this.db.$transaction(async tx => {
      const [consent] = await tx.$queryRaw<any[]>`SELECT c.*,p."revision" AS "policyRevision" FROM public."SmartNotificationConsent" c JOIN public."SmartNotificationPolicy" p ON p."category"=c."category" WHERE c."userId"=${user.id} AND c."category"=${category} AND c."granted" AND c."birthUse" AND c."expiresAt">CURRENT_TIMESTAMP AND p."approved" AND p."enabled" AND ${locale}=ANY(p."languages") AND p."entitlement"='FREE_APPROVED' FOR UPDATE OF c,p`;
      if (!consent) throw new NotFoundException('Insight unavailable');
      // Natal factors do not change daily. Generate once per explicit consent
      // revision rather than inventing daily events or repeatedly pushing the same chart.
      const key = createHash('sha256').update(JSON.stringify([LOCALIZED_SMART_VERSION,user.id,category,locale,consent.version])).digest('hex');
      const [existing] = await tx.$queryRaw<any[]>`SELECT "id" FROM public."SmartNotificationInsight" WHERE "generationKey"=${key}`;
      if (existing) return { success: true, data: { id: existing.id, category, deliverable: false, replay: true } };
      const content = await composeSmartAstrologyPreview(params, category, locale);
      const id = randomUUID();
      await tx.$executeRaw`INSERT INTO public."SmartNotificationInsight" ("id","userId","category","locale","title","body","provenance","factors","sourceVersion","generationKey","consentVersion","policyRevision","expiresAt") VALUES (${id},${user.id},${category},${locale},${content.title},${content.interpretation},'LOCAL_COMPUTED',${JSON.stringify(content.factors)}::jsonb,${content.calculationSource},${key},${consent.version},${consent.policyRevision},${new Date(Math.min(new Date(content.validUntil).getTime(),consent.expiresAt.getTime()))})`;
      await tx.$executeRaw`INSERT INTO public."SmartNotificationDelivery" ("id","insightId","userId") VALUES (${randomUUID()},${id},${user.id})`;
      await tx.appNotification.create({ data: { userId: user.id, ...smartReminderCopy(locale), type: 'smart_insight', data: { insightId: id, category } } });
      return { success: true, data: { id, category, deliverable: false } };
    }, { timeout: 15000 });
  }
}
