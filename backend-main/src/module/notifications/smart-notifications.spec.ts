jest.mock('../../common/guards/supabase-auth.guard',()=>({SupabaseAuthGuard:class{}}));
jest.mock('./notifications-identity.guard',()=>({NotificationsIdentityGuard:class{}}));
import { NotificationsService } from './notifications.service';
import { NotificationsCampaignService } from './notifications.campaign.service';
import { NotificationsController } from './notifications.controller';
import { composeSmartAstrologyPreview } from './smart-astrology-composer';
import { notificationCatalog } from './smart-astrology.catalog';
import { notificationLocalDate } from './notification-local-date';
import { calculateNatalYogas } from '../kundli/engine/natal-yoga.util';
import { DailyHoroscopePushProcessor } from '../astro/modules/dailyinsight/daily-horoscope-push.processor';

describe('smart notification safety and exact reading authorization',()=>{
  const original = {...process.env};
  afterEach(()=>{ for(const key of ['SMART_ASTROLOGY_PREVIEW_ENABLED','HOROSCOPE_DURABLE_ENABLED','HOROSCOPE_SCHEMA_READY','HOROSCOPE_OUTBOX_ENABLED','HOROSCOPE_REMINDER_POLICY_ENABLED','NOTIFICATION_EDITORIAL_CAMPAIGNS_ENABLED','NOTIFICATION_SELF_TEST_ENABLED','NODE_ENV']) {
    if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];
  }});
  it('scheduled daily pushes never enter the legacy fallback when durable delivery is off',async()=>{
    delete process.env.HOROSCOPE_OUTBOX_ENABLED;
    const processor=new DailyHoroscopePushProcessor({} as never,{} as never,{} as never,{} as never,{} as never);
    const legacy=jest.spyOn(processor,'processDailyHoroscopePushes').mockResolvedValue();
    await processor.scheduledDailyHoroscopePushes();expect(legacy).not.toHaveBeenCalled();
    process.env.HOROSCOPE_DURABLE_ENABLED='true';process.env.HOROSCOPE_SCHEMA_READY='true';process.env.HOROSCOPE_OUTBOX_ENABLED='true';process.env.HOROSCOPE_REMINDER_POLICY_ENABLED='true';
    await processor.scheduledDailyHoroscopePushes();expect(legacy).toHaveBeenCalledTimes(1);
  });
  function setup(){
    process.env.HOROSCOPE_DURABLE_ENABLED='true';process.env.HOROSCOPE_SCHEMA_READY='true';
    const reading={subscriptionId:'subscription',locale:'en',localDate:notificationLocalDate('UTC'),timezone:'UTC',response:{data:{ai:{notificationTitle:'Your daily reflection',shortReading:'Take a thoughtful approach to your day.',dailyAdvice:'Reflect before making important decisions.'}}}};
    const db={userAuthIdentity:{findUnique:jest.fn().mockResolvedValue({userId:'canonical'})},user:{findUnique:jest.fn().mockResolvedValue({isActive:true,isBlocked:false,userProfile:{lang:'en'}})},subscription:{findFirst:jest.fn().mockResolvedValue({id:'subscription'})},$queryRaw:jest.fn().mockResolvedValue([reading])};
    return {reading,db,service:new NotificationsService(db as never)};
  }
  it('retrieves only exact owned reading with live entitlement and no birth data',async()=>{
    const {service,db}=setup();const id='a'.repeat(64);const result=await service.getExactReading('subject',id);
    expect(result.data.id).toBe(id);expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual([id,'canonical']);
    expect(db.subscription.findFirst.mock.calls[0][0].where).toMatchObject({userId:'canonical',subscriptionStatus:'ACTIVE',user:{isActive:true,isBlocked:false}});
    expect(JSON.stringify(result)).not.toMatch(/birth|latitude|longitude|response/);
  });
  it.each(['foreign','expired','language','blocked','yesterday'])('denies %s reading',async kind=>{
    const {service,db,reading}=setup();
    if(kind==='foreign')db.$queryRaw.mockResolvedValue([]);
    if(kind==='expired')db.subscription.findFirst.mockResolvedValue(null);
    if(kind==='language')reading.locale='hi';
    if(kind==='blocked')db.user.findUnique.mockResolvedValue({isActive:true,isBlocked:true,userProfile:{lang:'en'}});
    if(kind==='yesterday')reading.localDate='2000-01-01';
    await expect(service.getExactReading('subject','a'.repeat(64))).rejects.toThrow('Reading unavailable');
  });
  it('rejects invalid IDs before identity/database access',async()=>{
    const {service,db}=setup();await expect(service.getExactReading('subject','../../other')).rejects.toThrow();expect(db.userAuthIdentity.findUnique).not.toHaveBeenCalled();
  });
  it('all editorial delivery is default-off and a switch cannot replace consent',async()=>{
    const campaign = new NotificationsCampaignService({} as never,{} as never,{} as never);
    delete process.env.NOTIFICATION_EDITORIAL_CAMPAIGNS_ENABLED;
    expect(await campaign.sendCampaignToUser('synthetic',campaign.buildDefaultCampaign('love'))).toMatchObject({skipped:true});
    process.env.NOTIFICATION_EDITORIAL_CAMPAIGNS_ENABLED='true';
    await expect(campaign.sendCampaignToUser('synthetic',campaign.buildDefaultCampaign('career'))).rejects.toThrow('consent');
  });
  it('self test never runs in production even if its switch is true',async()=>{
    process.env.NODE_ENV='production';process.env.NOTIFICATION_SELF_TEST_ENABLED='true';
    await expect(new NotificationsController({} as never,{} as never).testPush({} as never)).rejects.toThrow('disabled');
  });
  it('catalogue distinguishes editorial previews from personalized calculations',()=>{
    const data=notificationCatalog().data;expect(data.automaticDeliveryEnabled).toBe(false);expect(data.categories).toHaveLength(10);expect(data.existingHoroscopeLocales).toHaveLength(20);
    expect(data.unsupportedYogas).toContain('Mahalakshmi Yoga');expect(data.categories.every(c=>!c.personalized)).toBe(true);
  });
  it('handles explicit fractional offsets and DST without UTC fallback',()=>{
    expect(notificationLocalDate('5.75',new Date('2026-01-01T19:00:00Z'))).toBe('2026-01-02');
    expect(notificationLocalDate('America/New_York',new Date('2026-03-08T04:30:00Z'))).toBe('2026-03-07');
    expect(notificationLocalDate('America/New_York',new Date('2026-03-09T04:30:00Z'))).toBe('2026-03-09');
    expect(()=>notificationLocalDate('bad-zone')).toThrow();
  });
  it('preview is disabled before calculation and never falls back to English',async()=>{
    const birth={dob:'1995-08-15',tob:'10:30',lat:25.5941,lon:85.1376,timezone:5.5};
    delete process.env.SMART_ASTROLOGY_PREVIEW_ENABLED;
    await expect(composeSmartAstrologyPreview(birth,'love','en')).rejects.toThrow('disabled');
    process.env.SMART_ASTROLOGY_PREVIEW_ENABLED='true';
    await expect(composeSmartAstrologyPreview(birth,'love','xx')).rejects.toThrow('Unsupported');
    const insight=await composeSmartAstrologyPreview(birth,'love','en');
    expect(insight.factors[0].name).toBe('Venus');expect(insight.deliverable).toBe(false);expect(insight.deepLink).toBeNull();expect(insight.interpretation).toContain('not a prediction');
    await expect(composeSmartAstrologyPreview({...birth,tob:''},'love','en')).rejects.toThrow();
    await expect(composeSmartAstrologyPreview(birth,'cosmic','en')).rejects.toThrow('verified');
  });
  it.each([1,4,7,10])('Gajakesari uses Jupiter sign distance %s from Moon',sign=>{
    const planets=[{name:'Sun',sign_no:1,house:1},{name:'Moon',sign_no:1,house:1},{name:'Mercury',sign_no:1,house:1},{name:'Mars',sign_no:1,house:1},{name:'Jupiter',sign_no:sign,house:sign}];
    const rules=calculateNatalYogas(planets).flatMap(group=>group.yoga_list);
    expect(rules.find(rule=>rule.name==='Gajakesari Yoga')?.has_yoga).toBe(true);
    expect(rules.find(rule=>rule.name==='Budha-Aditya Yoga')?.has_yoga).toBe(true);
    expect(rules.find(rule=>rule.name==='Chandra-Mangala Yoga')?.has_yoga).toBe(true);
    const negative=calculateNatalYogas(planets.map(p=>['Mercury','Mars','Jupiter'].includes(p.name)?{...p,sign_no:2,house:2}:p)).flatMap(group=>group.yoga_list);
    expect(negative.every(rule=>!rule.has_yoga)).toBe(true);
  });
});
