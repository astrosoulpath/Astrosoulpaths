import { HOROSCOPE_LOCALES, validateHoroscopeText } from '../subscription/horoscope-localization';
import { localizedSmartInterpretation } from './smart-interpretation-localization';
import { composeSmartAstrologyPreview } from './smart-astrology-composer';
import { SmartPolicyService, SmartPolicyControls, validatePolicyControls } from './smart-policy.service';
import { notificationLocalMinute } from './notification-local-date';
import { SmartNotificationsService } from './smart-notifications.service';
import { SmartCategory, SMART_CATEGORIES } from './smart-astrology.catalog';
import { NotificationsPushService } from './notifications.push.service';
import { LocalVedicKundliProvider } from '../kundli/providers/local-vedic-kundli.provider';

describe('mobile localization and centralized policy controls',()=>{
 const before={...process.env};
 afterEach(()=>{for(const key of ['SMART_ASTROLOGY_PREVIEW_ENABLED','SMART_NOTIFICATIONS_SCHEMA_READY','SMART_NOTIFICATION_ENGAGEMENT_APPROVED']){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}});
 const birth={dob:'1995-08-15',tob:'10:30',lat:25.5941,lon:85.1376,timezone:5.5};
 let expectedFactor:{name:string;sign:string;house:number};
 beforeAll(async()=>{const report=await new LocalVedicKundliProvider().generate(birth,'en');const planet=report.planetaryPositions!.find(p=>p.name==='Venus')!;expectedFactor={name:planet.name,sign:planet.sign,house:planet.house!};});
 it.each(HOROSCOPE_LOCALES)('genuine local-engine output and script validated for %s',async locale=>{
  process.env.SMART_ASTROLOGY_PREVIEW_ENABLED='true';
  const result=await composeSmartAstrologyPreview(birth,'love',locale);
  expect(result.factors[0].name).toBe('Venus');expect(result.locale).toBe(locale);expect(result.deliverable).toBe(false);
  expect(result.factors[0]).toEqual(expectedFactor);
  expect(()=>validateHoroscopeText(locale,[result.title,result.interpretation])).not.toThrow();
  if(locale!=='en')expect(result.title).not.toBe('Love & relationships');
  if(locale!=='en')expect(result.interpretation).not.toContain('Computed sidereal natal factors');
  expect(result.linguisticReview).toBe('REQUIRED');
 });
 for(const locale of HOROSCOPE_LOCALES)it.each(['love','career','marriage','prosperity','education','growth','family','yoga'] as SmartCategory[])('localized category '+locale+'/%s preserves only verified facts',category=>{
  const factors=category==='yoga' ? ['Sun','Moon','Mercury','Mars','Jupiter'].map(name=>({name,sign:'Aries',house:1})) : [{name:SMART_CATEGORIES.find(c=>c.id===category)!.planet!,sign:'Aries',house:7}];
  const result=localizedSmartInterpretation(locale,category,factors,category==='yoga'?['Gajakesari Yoga']:[]);
  expect(result.title).toBeTruthy();expect(result.notice).toBeTruthy();expect(factors[0].sign).toBe('Aries');
 });
 it('unknown facts, events, yoga and locale fail instead of English/prediction fallback',()=>{
  expect(()=>localizedSmartInterpretation('xx','love',[{name:'Venus',sign:'Aries',house:7}])).toThrow();
  expect(()=>localizedSmartInterpretation('fr','cosmic',[{name:'Venus',sign:'Aries',house:7}])).toThrow();
  expect(()=>localizedSmartInterpretation('hi','yoga',[{name:'Venus',sign:'Aries',house:7}],['Raj Yoga'])).toThrow();
  expect(()=>localizedSmartInterpretation('en','career',[{name:'Invented',sign:'Aries',house:7}])).toThrow();
 });
 it('known yoga name with contradicting computed positions is rejected',()=>{
  const factors=['Sun','Moon','Mercury','Mars','Jupiter'].map(name=>({name,sign:['Mercury','Mars','Jupiter'].includes(name)?'Taurus':'Aries',house:1}));
  expect(()=>localizedSmartInterpretation('fr','yoga',factors,['Gajakesari Yoga'])).toThrow('evidence');
 });
 it('Admin native preview computes only a fixed synthetic chart without database access',async()=>{
  const db={$queryRaw:jest.fn()};const preview=await new SmartPolicyService(db as never).preview('career','fr');
  expect(preview.data.title).toBe('Carrière et évolution');expect(preview.data.source).toBe('SYNTHETIC_LOCAL_ENGINE_PREVIEW');expect(preview.data.deliverable).toBe(false);expect(db.$queryRaw).not.toHaveBeenCalled();
 });
 const input=():SmartPolicyControls=>({controlVersion:1,enabled:true,languages:['fr'],dailyLimit:2,minimumIntervalMs:3600000,quietStart:1320,quietEnd:480,scheduleMinute:540,languageReviewConfirmed:true});
 it('policy controls reject unreviewed languages, unknown locale and invalid caps',()=>{
  for(const patch of [{languageReviewConfirmed:false},{languages:['xx']},{dailyLimit:11},{quietStart:480},{scheduleMinute:1440},{minimumIntervalMs:0}])expect(()=>validatePolicyControls({...input(),...patch})).toThrow();
 });
 it('Admin controls cannot approve missing entitlement or overwrite stale version',async()=>{
  process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';
  const tx={$queryRaw:jest.fn().mockResolvedValue([{controlVersion:1,approved:false,entitlement:'UNAPPROVED'}]),$executeRaw:jest.fn()};const db={$transaction:jest.fn(fn=>fn(tx))};
  const service=new SmartPolicyService(db as never);
  await expect(service.update('admin','love',input())).rejects.toThrow('separate approval');expect(tx.$executeRaw).not.toHaveBeenCalled();
  tx.$queryRaw.mockResolvedValue([{controlVersion:2,approved:true,entitlement:'FREE_APPROVED'}]);
  await expect(service.update('admin','love',input())).rejects.toThrow('version');
 });
 it('disabling category is audited without enabling rollout or changing entitlement',async()=>{
  process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';
  const tx={$queryRaw:jest.fn().mockResolvedValue([{controlVersion:1,approved:false}]),$executeRaw:jest.fn().mockResolvedValue(1)};
  const result=await new SmartPolicyService({$transaction:jest.fn(fn=>fn(tx))} as never).update('admin','love',{...input(),enabled:false,languageReviewConfirmed:false});
  expect(result.data.enabled).toBe(false);expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  expect(tx.$executeRaw.mock.calls[0][0].join('')).not.toContain('"approved"=');
 });
 it('dedicated emergency disable needs no edited schedule or language fields',async()=>{
  process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';
  const tx={$queryRaw:jest.fn().mockResolvedValue([{enabled:true,controlVersion:5}]),$executeRaw:jest.fn().mockResolvedValue(1)};
  const service=new SmartPolicyService({$transaction:jest.fn(fn=>fn(tx))} as never);
  expect((await service.disable('admin','love')).data.enabled).toBe(false);
  expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  tx.$queryRaw.mockResolvedValue([{enabled:false,controlVersion:6}]);
  await service.disable('admin','love');expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
 });
 it('IANA/DST and fractional offsets support local scheduling',()=>{
  expect(notificationLocalMinute('5.75',new Date('2026-01-01T00:00Z'))).toBe(345);
  expect(notificationLocalMinute('America/New_York',new Date('2026-03-09T13:00Z'))).toBe(540);
 });
 it('engagement has a separate default-deny privacy gate',async()=>{
  delete process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED;const db={$executeRaw:jest.fn()};
  const result=await new SmartNotificationsService(db as never,{} as never).markOpened('subject','not-an-id');
  expect(result.data.recorded).toBe(false);expect(db.$executeRaw).not.toHaveBeenCalled();
 });
 it('tracking rollout does not replace individual customer purpose consent',async()=>{
  process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED='true';const db={$queryRaw:jest.fn().mockResolvedValue([{engagementGranted:false}]),$executeRaw:jest.fn(),$transaction:jest.fn()};
  db.$transaction.mockImplementation(fn=>fn(db));
  const service=new SmartNotificationsService(db as never,{} as never);jest.spyOn(service,'getInsight').mockResolvedValue({} as never);jest.spyOn(service,'user').mockResolvedValue({id:'owner'} as never);
  expect((await service.markOpened('subject','id')).data.reason).toBe('USER_TRACKING_CONSENT_REQUIRED');expect(db.$executeRaw).not.toHaveBeenCalled();
 });
 it('smart FCM selection excludes anything except Android and iOS',async()=>{
  const init=jest.spyOn(NotificationsPushService.prototype as any,'initializeFirebase').mockReturnValue(null);
  try {
   const db={pushDevice:{findMany:jest.fn().mockResolvedValue([])}};
   await new NotificationsPushService(db as never).sendToUser('owner',{title:'Neutral',body:'Neutral'},undefined,true);
   expect(db.pushDevice.findMany.mock.calls[0][0].where.platform.in).toEqual(['ANDROID','IOS']);
  }finally{init.mockRestore();}
 });
});
