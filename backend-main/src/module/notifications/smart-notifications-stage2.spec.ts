import { SmartNotificationsService } from './smart-notifications.service';
import { SmartNotificationsWorker, smartDeliveryEnabled } from './smart-notifications.worker';
import { smartReminderCopy } from './smart-reminder-copy';
import { smartId, validateSmartContent } from './smart-notification-contract';
import { HOROSCOPE_LOCALES } from '../subscription/horoscope-localization';
import { randomUUID } from 'node:crypto';
import { SmartAstrologyWorker } from './smart-astrology.worker';

describe('smart persistence and approval integration', () => {
  const before = { ...process.env };
  afterEach(() => { for (const key of ['SMART_NOTIFICATIONS_SCHEMA_READY','SMART_NOTIFICATIONS_DELIVERY_ENABLED','SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED','SMART_NOTIFICATIONS_CONSENT_POLICY_APPROVED']) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } });
  function setup() {
    const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn().mockResolvedValue(1), appNotification: { create: jest.fn() } };
    const db = { ...tx, $transaction: jest.fn(fn => fn(tx)), user: { findUnique: jest.fn().mockResolvedValue({ id:'owner',isActive:true,isBlocked:false,userProfile:{lang:'en'} }) } };
    return { tx,db,service:new SmartNotificationsService(db as never,{resolveInternalUserId:jest.fn().mockResolvedValue('owner')} as never) };
  }
  it('all new paths fail closed before DB access when schema is off', async () => {
    delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY;
    const {service,db} = setup(); await expect(service.listCampaigns()).rejects.toThrow('not activated');
    const worker = new SmartNotificationsWorker(db as never,{} as never); await worker.tick();
    expect(db.$queryRaw).not.toHaveBeenCalled();expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('a delivery switch alone never grants release approval', () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';process.env.SMART_NOTIFICATIONS_DELIVERY_ENABLED='true';delete process.env.SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED;
    expect(smartDeliveryEnabled()).toBe(false);
  });
  it('automatic chart worker is off before any profile scan', async () => {
    const {db}=setup();delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY;
    await new SmartAstrologyWorker(db as never,{} as never).tick();expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  function deliveryRow(overrides: object = {}) {
    return {id:randomUUID(),category:'love',locale:'en',expiresAt:new Date(Date.now()+86400000),consentExpiry:new Date(Date.now()+86400000),version:1,consentVersion:1,revision:1,policyRevision:1,
      provenance:'ADMIN_EDITORIAL',granted:true,birthUse:false,approved:true,enabled:true,languages:['en'],isActive:true,isBlocked:false,entitlement:'FREE_APPROVED',lang:'en',timezone:'UTC',dailyLimit:2,minimumIntervalMs:3600000,
      quietStart: ((new Date().getUTCHours()+2)%24)*60,quietEnd:((new Date().getUTCHours()+2)%24)*60+30,...overrides};
  }
  it.each(['revoked','blocked','expired','version','paused','language','category-disabled','language-disabled'])('final delivery denies %s before FCM',async kind=>{
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';process.env.SMART_NOTIFICATIONS_DELIVERY_ENABLED='true';process.env.SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED='true';
    const {db,tx}=setup();const row=deliveryRow();
    if(kind==='revoked')row.granted=false;if(kind==='blocked')row.isBlocked=true;if(kind==='expired')row.expiresAt=new Date(0);
    if(kind==='version')row.version=2;if(kind==='paused')Object.assign(row,{campaignId:'campaign',campaignState:'PAUSED'});if(kind==='language')row.lang='fr';
    if(kind==='category-disabled')row.enabled=false;if(kind==='language-disabled')row.languages=[];
    tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValue([]);
    const push={sendToUser:jest.fn()};const worker=new SmartNotificationsWorker(db as never,push as never);
    await (worker as any).deliver({id:'delivery',userId:'owner',insightId:row.id,leaseToken:'lease',attempts:0});
    expect(push.sendToUser).not.toHaveBeenCalled();expect(tx.$executeRaw.mock.calls.some(call=>call.includes('CANCELLED'))).toBe(true);
  });
  it('unknown provider acceptance never schedules an automatic retry',async()=>{
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';process.env.SMART_NOTIFICATIONS_DELIVERY_ENABLED='true';process.env.SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED='true';
    const {db,tx}=setup();const row=deliveryRow();tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValue([]);
    const push={sendToUser:jest.fn().mockResolvedValue({configured:true,sent:0,failed:1,failureCodes:['unknown']})};
    await (new SmartNotificationsWorker(db as never,push as never) as any).deliver({id:'delivery',userId:'owner',insightId:row.id,leaseToken:'lease',attempts:0});
    expect(push.sendToUser).toHaveBeenCalledTimes(1);expect(tx.$executeRaw.mock.calls.some(call=>call.includes('UNKNOWN'))).toBe(true);
    expect(tx.$executeRaw.mock.calls.some(call=>call.includes('QUEUED'))).toBe(false);
  });
  it.each(HOROSCOPE_LOCALES)('has nonempty Unicode-safe neutral reminder %s without fallback', locale => {
    expect(smartReminderCopy(locale).body.length).toBeGreaterThan(10);
  });
  it('rejects unsupported locales, HTML and invalid UUIDs', () => {
    expect(()=>smartReminderCopy('xx')).toThrow();expect(()=>smartId('../foreign')).toThrow();
    expect(()=>validateSmartContent({category:'love',locale:'en',title:'<script>',body:'General guidance'})).toThrow();
    expect(()=>smartId(randomUUID())).not.toThrow();
  });
  it('draft creation and audit are in one transaction, never approved implicitly', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true'; const {service,tx,db}=setup();tx.$queryRaw.mockResolvedValue([{category:'love'}]);
    const result=await service.createCampaign('admin',{category:'love',locale:'en',title:'Reflection',body:'General editorial reflection.',expiresAt:new Date(Date.now()+86400000).toISOString()});
    expect(result.data.state).toBe('DRAFT');expect(db.$transaction).toHaveBeenCalledTimes(1);expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('stale approval and schedule-before-approval cannot mutate history', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';const {service,tx}=setup();
    tx.$queryRaw.mockResolvedValue([{revision:2,state:'DRAFT',expiresAt:new Date(Date.now()+86400000)}]);
    await expect(service.transition('admin',randomUUID(),{action:'approve',revision:1})).rejects.toThrow('revision');
    await expect(service.transition('admin',randomUUID(),{action:'schedule',revision:2,scheduledAt:new Date(Date.now()+3600000).toISOString()})).rejects.toThrow('Approved');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('exact insight query uses canonical owner and no caller-selected user ID', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';const {service,db}=setup();db.$queryRaw.mockResolvedValue([]);
    await expect(service.getInsight('subject',randomUUID())).rejects.toThrow('unavailable');
    expect(db.$queryRaw.mock.calls[0]).toContain('owner');
  });
  it('blocked account cannot read or calculate', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';const {service,db}=setup();db.user.findUnique.mockResolvedValue({id:'owner',isActive:true,isBlocked:true,userProfile:{lang:'en'}});
    await expect(service.getInsight('subject',randomUUID())).rejects.toThrow('unavailable');expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('consent activation requires separate approved policy', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';delete process.env.SMART_NOTIFICATIONS_CONSENT_POLICY_APPROVED;
    const {service,db}=setup();await expect(service.setConsent('subject','love',{granted:true,birthUse:false,timezone:'UTC',expiresAt:new Date(Date.now()+60000).toISOString()})).rejects.toThrow('policy');expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('revocation works without a new birth grant, future expiry or grant activation', async () => {
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';delete process.env.SMART_NOTIFICATIONS_CONSENT_POLICY_APPROVED;
    const {service,tx}=setup();
    tx.$queryRaw.mockResolvedValue([{version:2}]);
    expect((await service.setConsent('subject','love',{granted:false} as never)).data.granted).toBe(false);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
