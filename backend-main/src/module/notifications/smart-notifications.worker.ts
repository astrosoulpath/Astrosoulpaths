import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from './notifications.push.service';
import { smartSchemaEnabled } from './smart-notification-contract';
import { evaluateSmartDelivery } from './smart-delivery-policy';
import { smartReminderCopy } from './smart-reminder-copy';

export function smartDeliveryEnabled() {
  const emergency = process.env.SMART_NOTIFICATIONS_EMERGENCY_DISABLED;
  return (emergency === undefined || emergency === 'false') && smartSchemaEnabled() && process.env.SMART_NOTIFICATIONS_DELIVERY_ENABLED === 'true' && process.env.SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED === 'true';
}
@Injectable()
export class SmartNotificationsWorker {
  constructor(private readonly db: PrismaService, private readonly push: NotificationsPushService) {}
  @Cron('*/30 * * * * *')
  async tick() {
    if (!smartDeliveryEnabled()) return;
    await this.db.$executeRaw`UPDATE public."SmartNotificationDelivery" SET "state"='FAILED',"resultCode"='MAX_ATTEMPTS' WHERE "state"='QUEUED' AND "attempts">=5`;
    await this.materialize();
    // A sender can crash after provider acceptance. Never automatically resend uncertain work.
    await this.db.$executeRaw`UPDATE public."SmartNotificationDelivery" SET "state"=CASE WHEN "state"='SENDING' THEN 'UNKNOWN' ELSE 'QUEUED' END,"leaseToken"=NULL,"leaseUntil"=NULL WHERE "state" IN ('SENDING','PROCESSING') AND "leaseUntil"<CURRENT_TIMESTAMP`;
    const token = randomUUID();
    const jobs = await this.db.$queryRaw<any[]>`WITH candidates AS (SELECT "id" FROM public."SmartNotificationDelivery" WHERE "state"='QUEUED' AND "nextAttemptAt"<=CURRENT_TIMESTAMP AND "attempts"<5 ORDER BY "createdAt","id" FOR UPDATE SKIP LOCKED LIMIT 20)
      UPDATE public."SmartNotificationDelivery" d SET "state"='PROCESSING',"leaseToken"=${token},"leaseUntil"=CURRENT_TIMESTAMP+interval '2 minutes' FROM candidates c WHERE d."id"=c."id" RETURNING d.*`;
    for (const job of jobs) {
      try { await this.deliver(job); }
      catch { await this.finish(job, 'UNKNOWN', 'WORKER_OR_ACCEPTANCE_UNKNOWN'); }
    }
  }
  private async materialize() {
    // Bounded audience per tick; uniqueness allows subsequent ticks to continue safely.
    await this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<any[]>`SELECT a."id" AS "campaignId",a."category",a."locale",a."title",a."body",a."expiresAt",c."userId",c."version",p."revision" FROM public."SmartNotificationCampaign" a
        JOIN public."SmartNotificationPolicy" p ON p."category"=a."category" JOIN public."SmartNotificationConsent" c ON c."category"=a."category"
        JOIN public."User" u ON u."id"=c."userId" JOIN public."UserProfile" f ON f."userId"=u."id"
        WHERE a."state"='SCHEDULED' AND a."scheduledAt"<=CURRENT_TIMESTAMP AND a."expiresAt">CURRENT_TIMESTAMP AND p."approved" AND p."enabled" AND a."locale"=ANY(p."languages") AND p."entitlement"='FREE_APPROVED'
        AND c."granted" AND c."expiresAt">CURRENT_TIMESTAMP AND u."isActive" AND NOT u."isBlocked" AND lower(f."lang")=a."locale"
        AND EXISTS(SELECT 1 FROM public."SmartNotificationAudit" r WHERE r."objectId"=a."id" AND r."action"='APPROVED' AND r."details"->>'checklistVersion'='smart-editorial-safety-v1' AND r."details"->>'contentPolicyReviewed'='true')
        AND NOT EXISTS(SELECT 1 FROM public."SmartNotificationInsight" i WHERE i."userId"=c."userId" AND i."campaignId"=a."id") ORDER BY a."createdAt",c."userId" LIMIT 100`;
      for (const row of rows) {
        const id = randomUUID();
        const inserted = await tx.$executeRaw`INSERT INTO public."SmartNotificationInsight" ("id","userId","category","locale","title","body","provenance","sourceVersion","consentVersion","policyRevision","campaignId","expiresAt") VALUES (${id},${row.userId},${row.category},${row.locale},${row.title},${row.body},'ADMIN_EDITORIAL','editorial-v1',${row.version},${row.revision},${row.campaignId},${row.expiresAt}) ON CONFLICT ("userId","campaignId") DO NOTHING`;
        if (inserted === 1) {
          await tx.$executeRaw`INSERT INTO public."SmartNotificationDelivery" ("id","insightId","userId") VALUES (${randomUUID()},${id},${row.userId})`;
          await tx.appNotification.create({ data: { userId: row.userId, ...smartReminderCopy(row.locale), type: 'smart_insight', data: { insightId: id, category: row.category } } });
        }
      }
    });
  }
  private async deliver(job: any) {
    const content = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(1196377165,hashtext(${job.userId}))::text AS lock_result`;
      const [row] = await tx.$queryRaw<any[]>`SELECT i.*,c."granted",c."birthUse",c."version",c."expiresAt" AS "consentExpiry",c."timezone",p."approved",p."enabled",p."languages",p."entitlement",p."revision",p."dailyLimit",p."minimumIntervalMs",p."quietStart",p."quietEnd",u."isActive",u."isBlocked",f."lang",a."state" AS "campaignState",a."scheduledAt"
        FROM public."SmartNotificationInsight" i JOIN public."SmartNotificationConsent" c ON c."userId"=i."userId" AND c."category"=i."category"
        JOIN public."SmartNotificationPolicy" p ON p."category"=i."category" JOIN public."User" u ON u."id"=i."userId" JOIN public."UserProfile" f ON f."userId"=u."id"
        LEFT JOIN public."SmartNotificationCampaign" a ON a."id"=i."campaignId" WHERE i."id"=${job.insightId} AND i."userId"=${job.userId} FOR SHARE OF c,p,u`;
      if (!row || !row.enabled || !row.languages?.includes(row.locale) || row.expiresAt <= new Date() || row.version !== row.consentVersion || row.revision !== row.policyRevision ||
          (row.campaignId && (row.campaignState !== 'SCHEDULED' || row.scheduledAt > new Date()))) return null;
      if (row.campaignId) {
        const [campaign]=await tx.$queryRaw<any[]>`SELECT a."state",a."scheduledAt",
          EXISTS(SELECT 1 FROM public."SmartNotificationAudit" r WHERE r."objectId"=a."id" AND r."action"='APPROVED' AND r."details"->>'checklistVersion'='smart-editorial-safety-v1' AND r."details"->>'contentPolicyReviewed'='true') AS "reviewed"
          FROM public."SmartNotificationCampaign" a WHERE a."id"=${row.campaignId} FOR SHARE OF a`;
        if (!campaign || campaign.state!=='SCHEDULED' || !campaign.scheduledAt || campaign.scheduledAt>new Date() || !campaign.reviewed) return null;
      }
      // Admin controls allow intervals longer than two days. Truncating history
      // to 48h would silently bypass those approved limits.
      const historyWindowMs = Math.max(48*3600000,Number(row.minimumIntervalMs));
      const history = await tx.$queryRaw<any[]>`SELECT "attemptedAt" FROM public."SmartNotificationDelivery" WHERE "userId"=${job.userId} AND "attemptedAt">CURRENT_TIMESTAMP-(${historyWindowMs}::double precision * interval '1 millisecond')`;
      const decision = evaluateSmartDelivery({ now: new Date(), enabled: smartDeliveryEnabled(), policyApproved: row.approved, activeAccount: row.isActive && !row.isBlocked,
        category: row.category, consent: { category: row.category, granted: row.granted, birthUse: row.birthUse, expiresAt: row.consentExpiry }, requiresBirthData: row.provenance === 'LOCAL_COMPUTED',
        entitled: row.entitlement === 'FREE_APPROVED', locale: row.lang?.trim().toLowerCase() ?? '', contentLocale: row.locale, timezone: row.timezone,
        quietHours: { startMinute: row.quietStart, endMinute: row.quietEnd }, dailyLimit: row.dailyLimit, minimumIntervalMs: Number(row.minimumIntervalMs), recentAttempts: history.map(h => h.attemptedAt) });
      if (!decision.allowed) return ['QUIET_HOURS','DAILY_LIMIT','MINIMUM_INTERVAL'].includes(decision.reason) ? { deferred: true } : null;
      const updated = await tx.$executeRaw`UPDATE public."SmartNotificationDelivery" SET "state"='SENDING',"attempts"="attempts"+1,"attemptedAt"=CURRENT_TIMESTAMP WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "state"='PROCESSING' AND "leaseUntil">CURRENT_TIMESTAMP`;
      return updated === 1 ? row : null;
    });
    if (!content) return this.finish(job, 'CANCELLED', 'POLICY_CONSENT_OR_FREQUENCY');
    if (content.deferred) return this.finish(job, 'QUEUED', 'FREQUENCY_DEFERRED');
    // No birth details, chart interpretation or editorial body in OS payloads.
    const result = await this.push.sendToUser(job.userId, { ...smartReminderCopy(content.locale), expiresAt: new Date(Math.min(content.expiresAt.getTime(),content.consentExpiry.getTime())),
      data: { type: 'smart_insight', insightId: content.id, category: content.category, locale: content.locale, ownerId: job.userId, deliveryId: job.id, expiresAt:new Date(Math.min(content.expiresAt.getTime(),content.consentExpiry.getTime())).toISOString() } }, undefined, true);
    if (!result.configured) return this.finish(job, 'QUEUED', 'FCM_NOT_CONFIGURED');
    if (result.sent === 0 && result.failureCodes?.length && result.failureCodes.every(code => ['messaging/quota-exceeded','messaging/server-unavailable'].includes(code)))
      return this.finish(job, 'QUEUED', 'FCM_TRANSIENT');
    return this.finish(job, result.sent > 0 && result.failed === 0 ? 'ACCEPTED' : 'UNKNOWN', result.sent > 0 && result.failed === 0 ? 'FCM_ACCEPTED' : 'FCM_ACCEPTANCE_UNKNOWN');
  }
  private async finish(job: any, state: string, code: string) {
    const retryAt = new Date(Date.now() + (code === 'FREQUENCY_DEFERRED' ? 1800000 : Math.min(900,30*2**Math.min(job.attempts+1,5))*1000));
    await this.db.$executeRaw`UPDATE public."SmartNotificationDelivery" SET "state"=${state},"resultCode"=${code},"nextAttemptAt"=${retryAt},"leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "state" IN ('PROCESSING','SENDING') AND "leaseUntil">CURRENT_TIMESTAMP`;
  }
}
