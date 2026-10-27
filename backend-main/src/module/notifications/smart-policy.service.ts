import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { requireSmartSchema } from './smart-notification-contract';
import { requireHoroscopeLocale } from '../subscription/horoscope-localization';
import { SMART_CATEGORIES, SmartCategory } from './smart-astrology.catalog';
import { LocalVedicKundliProvider } from '../kundli/providers/local-vedic-kundli.provider';
import { calculateNatalYogas } from '../kundli/engine/natal-yoga.util';
import { localizedSmartInterpretation } from './smart-interpretation-localization';

export type SmartPolicyControls = {controlVersion:number;enabled:boolean;languages:string[];dailyLimit:number;minimumIntervalMs:number;quietStart:number;quietEnd:number;scheduleMinute:number;languageReviewConfirmed:boolean};
export function validatePolicyControls(input: SmartPolicyControls) {
  if (!input || typeof input.enabled !== 'boolean' || !Array.isArray(input.languages) || input.languages.length > 20 || new Set(input.languages).size !== input.languages.length)
    throw new BadRequestException('Explicit category and language controls required');
  input.languages.forEach(requireHoroscopeLocale);
  if (input.enabled && input.languageReviewConfirmed !== true) throw new BadRequestException('Explicit language review acknowledgement required');
  if (!Number.isInteger(input.controlVersion) || input.controlVersion < 1 || !Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 10 ||
      !Number.isSafeInteger(input.minimumIntervalMs) || input.minimumIntervalMs < 3600000 || input.minimumIntervalMs > 2147483647 ||
      ![input.quietStart,input.quietEnd,input.scheduleMinute].every(v=>Number.isInteger(v)&&v>=0&&v<1440) || input.quietStart===input.quietEnd || (input.enabled && !input.languages.length))
    throw new BadRequestException('Invalid schedule or frequency policy');
}
@Injectable()
export class SmartPolicyService {
  constructor(private readonly db: PrismaService) {}
  async list() {
    requireSmartSchema();
    return {success:true,data:await this.db.$queryRaw`SELECT * FROM public."SmartNotificationPolicy" ORDER BY "category"`};
  }
  async metrics() {
    requireSmartSchema();
    const rows=await this.db.$queryRaw`SELECT i."category",i."locale",d."state",count(*)::int AS "deliveries",count(o."insightId")::int AS "uniqueAuthorizedViews"
      FROM public."SmartNotificationInsight" i JOIN public."SmartNotificationDelivery" d ON d."insightId"=i."id"
      LEFT JOIN public."SmartNotificationOpen" o ON o."insightId"=i."id" GROUP BY i."category",i."locale",d."state" ORDER BY i."category",i."locale",d."state" LIMIT 500`;
    return {success:true,data:{rows,engagementTrackingEnabled:process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED==='true',meaning:'Unique authenticated detail-view events; not proof of attention or OS display'}};
  }
  async update(actorId:string,category:string,input:SmartPolicyControls) {
    requireSmartSchema();validatePolicyControls(input);
    if (!SMART_CATEGORIES.some(c=>c.id===category)) throw new BadRequestException('Unknown category');
    return this.db.$transaction(async tx=>{
      const [policy]=await tx.$queryRaw<any[]>`SELECT * FROM public."SmartNotificationPolicy" WHERE "category"=${category} FOR UPDATE`;
      if (!policy || policy.controlVersion!==input.controlVersion) throw new ConflictException('Policy control version changed');
      if (input.enabled && (!policy.approved || policy.entitlement!=='FREE_APPROVED')) throw new ConflictException('Category entitlement and consent policy need separate approval');
      await tx.$executeRaw`UPDATE public."SmartNotificationPolicy" SET "enabled"=${input.enabled},"languages"=${input.languages}::text[],"dailyLimit"=${input.dailyLimit},"minimumIntervalMs"=${input.minimumIntervalMs},"quietStart"=${input.quietStart},"quietEnd"=${input.quietEnd},"scheduleMinute"=${input.scheduleMinute},"controlVersion"="controlVersion"+1 WHERE "category"=${category}`;
      await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action","details") VALUES (${randomUUID()},${actorId},${category},'CONTROLS_UPDATED',${JSON.stringify(input)}::jsonb)`;
      return {success:true,data:{category,controlVersion:input.controlVersion+1,enabled:input.enabled}};
    });
  }
  async disable(actorId:string,category:string) {
    requireSmartSchema();
    if (!SMART_CATEGORIES.some(c=>c.id===category)) throw new BadRequestException('Unknown category');
    return this.db.$transaction(async tx=>{
      const [policy]=await tx.$queryRaw<any[]>`SELECT "enabled","controlVersion" FROM public."SmartNotificationPolicy" WHERE "category"=${category} FOR UPDATE`;
      if (!policy) throw new ConflictException('Category policy not installed');
      if (policy.enabled) {
        await tx.$executeRaw`UPDATE public."SmartNotificationPolicy" SET "enabled"=false,"controlVersion"="controlVersion"+1 WHERE "category"=${category}`;
        await tx.$executeRaw`INSERT INTO public."SmartNotificationAudit" ("id","actorId","objectId","action","details") VALUES (${randomUUID()},${actorId},${category},'CATEGORY_DISABLED',${JSON.stringify({controlVersion:policy.controlVersion+1})}::jsonb)`;
      }
      return {success:true,data:{category,enabled:false}};
    });
  }
  async preview(category:SmartCategory,locale:string) {
    requireHoroscopeLocale(locale);
    const definition=SMART_CATEGORIES.find(c=>c.id===category);
    if (!definition || (!definition.planet && category!=='yoga')) throw new BadRequestException('No verified calculation pipeline for this category');
    // Fixed synthetic birth data only. No caller-selected customer/profile/UID.
    const report=await new LocalVedicKundliProvider().generate({dob:'1995-08-15',tob:'10:30',lat:25.5941,lon:85.1376,timezone:5.5},locale);
    const all=report.planetaryPositions??[];
    const selected=category==='yoga'?all.filter(p=>['Sun','Moon','Mercury','Mars','Jupiter'].includes(p.name)):all.filter(p=>p.name===definition.planet);
    const yogas=category==='yoga'?calculateNatalYogas(all.map(p=>({name:p.name,sign_no:p.sign_no,house:p.house!}))).flatMap(g=>g.yoga_list).filter(y=>y.has_yoga).map(y=>y.name):[];
    return {success:true,data:{...localizedSmartInterpretation(locale,category,selected.map(p=>({name:p.name,sign:p.sign,house:p.house!})),yogas),locale,source:'SYNTHETIC_LOCAL_ENGINE_PREVIEW',deliverable:false}};
  }
}
