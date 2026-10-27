import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SmartNotificationsService } from './smart-notifications.service';
import { smartDeliveryEnabled } from './smart-notifications.worker';
import { SmartCategory } from './smart-astrology.catalog';
import { notificationLocalMinute } from './notification-local-date';
import { LOCALIZED_SMART_VERSION } from './smart-interpretation-localization';

@Injectable()
export class SmartAstrologyWorker {
  private readonly logger = new Logger(SmartAstrologyWorker.name);
  private cursorUser = '';
  private cursorCategory = '';
  private running = false;
  constructor(private readonly db: PrismaService, private readonly smart: SmartNotificationsService) {}
  @Cron('*/5 * * * *')
  async tick() {
    if (!smartDeliveryEnabled() || process.env.SMART_ASTROLOGY_AUTOMATIC_ENABLED !== 'true' || process.env.SMART_ASTROLOGY_PREVIEW_ENABLED !== 'true') return;
    if (this.running) return;
    this.running = true;
    let generated=0, deferred=0, failed=0;
    try {
    const rows = await this.db.$queryRaw<any[]>`SELECT c."userId",u."supabaseId",c."category",c."timezone" AS "deliveryTimezone",p."scheduleMinute",f."dateOfBirth",f."timeOfBirth",f."latitude",f."longitude",f."timezone"
      FROM public."SmartNotificationConsent" c JOIN public."SmartNotificationPolicy" p ON p."category"=c."category"
      JOIN public."User" u ON u."id"=c."userId" JOIN public."UserProfile" f ON f."userId"=u."id"
      WHERE c."granted" AND c."birthUse" AND c."expiresAt">CURRENT_TIMESTAMP AND p."approved" AND p."enabled" AND lower(f."lang")=ANY(p."languages") AND p."entitlement"='FREE_APPROVED'
      AND u."isActive" AND NOT u."isBlocked" AND f."birthTimeKnown" AND f."dateOfBirth" IS NOT NULL AND f."timeOfBirth" IS NOT NULL
      AND f."latitude" IS NOT NULL AND f."longitude" IS NOT NULL AND f."timezone" IS NOT NULL
      AND c."category" IN ('love','career','prosperity','marriage','yoga','education','growth','family')
      AND (c."userId"::text,c."category") > (${this.cursorUser},${this.cursorCategory})
      AND NOT EXISTS(SELECT 1 FROM public."SmartNotificationInsight" i WHERE i."userId"=c."userId" AND i."category"=c."category" AND i."consentVersion"=c."version" AND i."locale"=lower(f."lang") AND i."sourceVersion" LIKE ${'%/'+LOCALIZED_SMART_VERSION} AND i."provenance"='LOCAL_COMPUTED')
      ORDER BY c."userId"::text,c."category" LIMIT 20`;
    if (!rows.length) { this.cursorUser=''; this.cursorCategory=''; }
    for (const row of rows) {
      // Advance even when no yoga is present, birth data is invalid or local
      // start time has not arrived. A failing first page must not starve others.
      this.cursorUser=row.userId; this.cursorCategory=row.category;
      try {
        if (notificationLocalMinute(row.deliveryTimezone) < row.scheduleMinute) { deferred++; continue; }
        await this.smart.prepareComputed(row.supabaseId, row.category as SmartCategory, { dob: row.dateOfBirth.toISOString().slice(0,10), tob: row.timeOfBirth, lat: row.latitude, lon: row.longitude, timezone: row.timezone });
        generated++;
      } catch { failed++; /* No raw chart data, identity or provider error is logged. No fallback prediction. */ }
    }
    if (rows.length) this.logger.log({event:'smart_generation_batch',scanned:rows.length,generated,deferred,failed});
    } catch { this.logger.warn('Smart generation scan unavailable');
    } finally { this.running = false; }
  }
}
