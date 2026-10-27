import { randomUUID } from 'node:crypto';
import { HOROSCOPE_LOCALES, validateHoroscopeText } from '../subscription/horoscope-localization';
import { SMART_CATEGORIES, SmartCategory } from './smart-astrology.catalog';
import { smartLocalizationInventory, localizedSmartInterpretation } from './smart-interpretation-localization';
import { smartReminderCopy } from './smart-reminder-copy';
import { validateSmartContent } from './smart-notification-contract';
import { SmartNotificationsService } from './smart-notifications.service';
import { SmartNotificationsWorker } from './smart-notifications.worker';
import OpenAI from 'openai';
import { DailyHoroscopeAiService } from '../astro/modules/dailyinsight/daily-horoscope-ai.service';
jest.mock('openai');

describe('Stage5 policy and exact localization QA (not qualified human review)',()=>{
 const original={...process.env};afterEach(()=>{process.env={...original};});
 const en=smartLocalizationInventory('en');
 it.each(HOROSCOPE_LOCALES)('%s complete dictionary, safe Unicode and placeholder contracts',locale=>{
  const copy=smartLocalizationInventory(locale);
  expect(copy.categories).toHaveLength(8);expect(copy.planets).toHaveLength(7);expect(copy.signs).toHaveLength(12);expect(copy.yogas).toHaveLength(3);
  const fields=[...copy.categories,...copy.planets,...copy.signs,...copy.yogas,copy.heading,copy.house,copy.reflection,copy.notice];
  for(const field of fields){expect(field.trim()).toBeTruthy();expect(Buffer.from(field,'utf8').toString('utf8')).toBe(field);expect(field).not.toMatch(/[\uFFFD\u0000-\u001f\u202a-\u202e\u2066-\u2069{}<>]|%[sd]/u);}
  for(const field of fields)expect(field).not.toMatch(/[\u00c3\u00c2][\u0080-\u00bf]|\u00e2\u20ac|\u00f0\u0178/u);
  expect(()=>validateHoroscopeText(locale,fields)).not.toThrow();
  if(locale!=='en'){expect(copy.reflection).not.toBe(en.reflection);expect(copy.notice).not.toBe(en.notice);expect(copy.categories).not.toEqual(en.categories);}
  const reminder=smartReminderCopy(locale);expect(reminder.title.length).toBeLessThanOrEqual(120);expect(reminder.body.length).toBeLessThanOrEqual(3000);
  expect(Buffer.byteLength(JSON.stringify({notification:reminder,data:{type:'smart_insight',locale,ownerId:randomUUID(),insightId:randomUUID(),deliveryId:randomUUID(),expiresAt:'2026-10-18T00:00:00.000Z'}}),'utf8')).toBeLessThan(4096);
  expect(()=>validateHoroscopeText(locale,[reminder.body])).not.toThrow();
 });
 const categories=['love','career','prosperity','marriage','yoga','education','growth','family'] as SmartCategory[];
 for(const locale of HOROSCOPE_LOCALES)it.each(categories)(locale+'/%s immutable calculated facts and length limits',category=>{
  const factors=category==='yoga'?['Sun','Moon','Mercury','Mars','Jupiter'].map(name=>({name,sign:'Aries',house:1})):[{name:SMART_CATEGORIES.find(c=>c.id===category)!.planet!,sign:'Aries',house:7}];
  const before=JSON.stringify(factors);const yogas=category==='yoga'?['Budha-Aditya Yoga','Chandra-Mangala Yoga','Gajakesari Yoga']:[];
  const output=localizedSmartInterpretation(locale,category,factors,yogas);
  expect(JSON.stringify(factors)).toBe(before);expect(output.title.length).toBeLessThanOrEqual(120);expect(output.interpretation.length).toBeLessThanOrEqual(3000);
  for(const name of yogas)expect(output.interpretation).toContain(name);
  expect(output.linguisticReview).toBe('REQUIRED');expect(output.interpretation).toContain(smartLocalizationInventory(locale).notice);
 });
 it('inventory returns detached arrays, not mutable production templates',()=>{const copy=smartLocalizationInventory('fr');copy.categories[0]='tampered';expect(smartLocalizationInventory('fr').categories[0]).not.toBe('tampered');});
 it('wrong-category, duplicate/contradictory and unrelated yoga evidence is rejected',()=>{
  const venus={name:'Venus',sign:'Aries',house:7};
  expect(()=>localizedSmartInterpretation('fr','career',[venus])).toThrow('Category evidence');
  expect(()=>localizedSmartInterpretation('en','love',[venus,venus])).toThrow('Category evidence');
  expect(()=>localizedSmartInterpretation('hi','love',[venus],['Gajakesari Yoga'])).toThrow('Category evidence');
 });
 it.each(['{{customer}}','{birthDate}','%s',String.fromCharCode(0x202e),'%d'])('unexpanded placeholders and directional spoofing reject before draft storage %s',suffix=>{
  expect(()=>validateSmartContent({category:'love',locale:'en',title:'Reflection',body:'General reflection '+suffix})).toThrow();
 });
 function setup(){process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';const tx={$queryRaw:jest.fn().mockResolvedValue([{state:'DRAFT',revision:1,expiresAt:new Date(Date.now()+86400000),category:'love',locale:'en',title:'Reflection',body:'General editorial guidance.'}]),$executeRaw:jest.fn().mockResolvedValue(1)};return {tx,service:new SmartNotificationsService({$transaction:jest.fn(fn=>fn(tx))} as never,{} as never)};}
 it.each([undefined,false,'true'])('approval cannot imply or coerce content review %s',async reviewed=>{
  const {service,tx}=setup();await expect(service.transition('synthetic-admin',randomUUID(),{action:'approve',revision:1,contentPolicyReviewed:reviewed as any})).rejects.toThrow('Explicit editorial safety');expect(tx.$executeRaw).not.toHaveBeenCalled();
 });
 it('explicit review is audited without approving category entitlement or granting consent',async()=>{
  const {service,tx}=setup();await service.transition('synthetic-admin',randomUUID(),{action:'approve',revision:1,contentPolicyReviewed:true});
  expect(tx.$executeRaw).toHaveBeenCalledTimes(2);expect(tx.$executeRaw.mock.calls[1]).toContain(JSON.stringify({contentPolicyReviewed:true,checklistVersion:'smart-editorial-safety-v1'}));
  expect(tx.$executeRaw.mock.calls[0][0].join('')).not.toContain('SmartNotificationPolicy');
 });
 it.each([null,{state:'PAUSED',scheduledAt:new Date(0),reviewed:true},{state:'SCHEDULED',scheduledAt:new Date(0),reviewed:false}])('old or paused editorial approval cannot send %j',async campaign=>{
  const tx={$queryRaw:jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{campaignId:'campaign',campaignState:'SCHEDULED',scheduledAt:new Date(0),enabled:true,languages:['en'],locale:'en',expiresAt:new Date(Date.now()+86400000),version:1,consentVersion:1,revision:1,policyRevision:1}]).mockResolvedValueOnce(campaign?[campaign]:[]),$executeRaw:jest.fn()};
  const db={$transaction:jest.fn(fn=>fn(tx)),$executeRaw:jest.fn()};const push={sendToUser:jest.fn()};
  await (new SmartNotificationsWorker(db as never,push as never) as any).deliver({id:'job',userId:'owner',insightId:'id',leaseToken:'lease'});
  expect(push.sendToUser).not.toHaveBeenCalled();
 });
 it('existing paid daily AI instructions prohibit private-thought claims urgency and notification birth data',async()=>{
  process.env.OPENAI_API_KEY='synthetic-not-a-real-key';
  const text='Reflect calmly on your day.';
  const create=jest.fn().mockResolvedValue({output_text:JSON.stringify({locale:'en',notificationTitle:'Daily reflection',shortReading:text,dailyAdvice:text,generalGuidance:text,lifeAreas:{general:text,career:text,relationships:text,health:text,finance:text},favorableActivities:[],cautionActivities:[],mood:'',focusArea:'',luckyColor:'',luckyNumber:null}),model:'synthetic'});
  (OpenAI as unknown as jest.Mock).mockImplementation(()=>({responses:{create}}));
  await new DailyHoroscopeAiService().generate({name:'Synthetic',targetDate:'2026-10-17',requestedDay:'today',languageCode:'en',languageName:'English',languageNativeName:'English',vedicData:{source:'synthetic'}});
  const instructions=create.mock.calls[0][0].instructions;
  for(const phrase of ['private thoughts','deceptive urgency','private birth data','Use only the supplied real Vedic astrology calculation data'])expect(instructions).toContain(phrase);
 });
});
