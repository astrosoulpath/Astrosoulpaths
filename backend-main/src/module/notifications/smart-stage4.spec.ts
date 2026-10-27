import { SmartNotificationsService } from './smart-notifications.service';
import { SmartAstrologyWorker } from './smart-astrology.worker';
import { NotificationsPushService } from './notifications.push.service';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps, initializeApp } from 'firebase-admin/app';
jest.mock('firebase-admin/messaging',()=>({getMessaging:jest.fn()}));
jest.mock('firebase-admin/app',()=>({getApps:jest.fn(),initializeApp:jest.fn(),cert:jest.fn().mockReturnValue({})}));
describe('Stage4 pre-mobile race and isolation protections',()=>{
 const original={...process.env};
 afterEach(()=>{process.env={...original};jest.restoreAllMocks();});
 it('push rejects an already initialized app from a different Firebase project',()=>{
  Object.assign(process.env,{FIREBASE_PROJECT_ID:'synthetic-target',FIREBASE_CLIENT_EMAIL:'synthetic@example.invalid',FIREBASE_PRIVATE_KEY:'synthetic'});
  (getApps as jest.Mock).mockReturnValue([{options:{projectId:'wrong-project'}}]);
  const push:any=new NotificationsPushService({} as never);expect(push.firebaseApp).toBeNull();expect(initializeApp).not.toHaveBeenCalled();
 });
 it('push selects the matching Firebase project rather than the first app',()=>{
  Object.assign(process.env,{FIREBASE_PROJECT_ID:'synthetic-target',FIREBASE_CLIENT_EMAIL:'synthetic@example.invalid',FIREBASE_PRIVATE_KEY:'synthetic'});
  const app={options:{projectId:'synthetic-target'}};(getApps as jest.Mock).mockReturnValue([{options:{projectId:'wrong-project'}},app]);
  expect((new NotificationsPushService({} as never) as any).firebaseApp).toBe(app);
 });
 function tracking(rows:any[]= [{engagementGranted:true}],campaigns:any[]=[]) {
  process.env.SMART_NOTIFICATION_ENGAGEMENT_APPROVED='true';
  const tx={$queryRaw:jest.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce(campaigns),$executeRaw:jest.fn().mockResolvedValue(1)};
  const db={$transaction:jest.fn(fn=>fn(tx))};const service=new SmartNotificationsService(db as never,{} as never);
  jest.spyOn(service,'getInsight').mockResolvedValue({} as never);jest.spyOn(service,'user').mockResolvedValue({id:'owner'} as never);
  return {service,tx,db};
 }
 it('tracking locks current consent, policy, account and language through insertion',async()=>{
  const {service,tx,db}=tracking();expect((await service.markOpened('subject','id')).data.recorded).toBe(true);
  expect(db.$transaction).toHaveBeenCalledTimes(1);const sql=tx.$queryRaw.mock.calls[0][0].join('');
  for(const clause of ['FOR SHARE OF c,p,u,f','"consentVersion"','"policyRevision"','"isBlocked"','"expiresAt"','ANY(p."languages")'])expect(sql).toContain(clause);
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
 });
 it.each([{rows:[]},{rows:[{engagementGranted:false}]}])('revocation before locked recheck prevents tracking %j',async ({rows})=>{
  const {service,tx}=tracking(rows);expect((await service.markOpened('subject','id')).data.recorded).toBe(false);expect(tx.$executeRaw).not.toHaveBeenCalled();
 });
 it('paused campaign prevents tracking after initial content check',async()=>{
  const {service,tx}=tracking(undefined,[{state:'PAUSED'}]);expect((await service.markOpened('subject','id')).data.recorded).toBe(false);expect(tx.$executeRaw).not.toHaveBeenCalled();
 });
 it('transaction failure never falls back to an unlocked analytics write',async()=>{
  const {service,tx,db}=tracking();db.$transaction.mockRejectedValue(new Error('synthetic'));await expect(service.markOpened('subject','id')).rejects.toThrow();expect(tx.$executeRaw).not.toHaveBeenCalled();
 });
 function sender(current:any,code?:string) {
  const push:any=Object.create(NotificationsPushService.prototype);push.firebaseApp={};push.logger={warn:jest.fn()};
  const send=code?jest.fn().mockRejectedValue({code}):jest.fn().mockResolvedValue('synthetic');(getMessaging as jest.Mock).mockReturnValue({send});
  const device={id:'device',fcmToken:'synthetic'};
  push.prisma={pushDevice:{findMany:jest.fn().mockResolvedValue([device]),findFirst:jest.fn().mockResolvedValue(current),updateMany:jest.fn()}};return {push,send};
 }
 it('reassigned or logged-out device is never sent a stale owner reminder',async()=>{
  const {push,send}=sender(null);const result=await push.sendToUser('old-owner',{title:'Neutral',body:'Neutral'});
  expect(send).not.toHaveBeenCalled();expect(result.failureCodes).toEqual(['DEVICE_OWNERSHIP_CHANGED']);
 });
 it('valid owned device retains existing FCM payload contract',async()=>{
  const {push,send}=sender({id:'device'});expect((await push.sendToUser('owner',{title:'Neutral',body:'Neutral'})).sent).toBe(1);expect(send).toHaveBeenCalledTimes(1);
 });
 it('invalid-token cleanup cannot deactivate a reassigned device',async()=>{
  const {push}=sender({id:'device'},'messaging/registration-token-not-registered');await push.sendToUser('owner',{title:'Neutral',body:'Neutral'});
  expect(push.prisma.pushDevice.updateMany).toHaveBeenCalledWith({where:{id:'device',userId:'owner',isActive:true,fcmToken:'synthetic'},data:{isActive:false}});
 });
 function enabled(){for(const key of ['SMART_NOTIFICATIONS_SCHEMA_READY','SMART_NOTIFICATIONS_DELIVERY_ENABLED','SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED','SMART_ASTROLOGY_AUTOMATIC_ENABLED','SMART_ASTROLOGY_PREVIEW_ENABLED'])process.env[key]='true';}
 it('failed first-page generation advances cursor so later customers are considered',async()=>{
  enabled();const row={userId:'u1',category:'yoga',supabaseId:'subject',deliveryTimezone:'UTC',scheduleMinute:0,dateOfBirth:new Date('1995-01-01'),timeOfBirth:'12:00',latitude:1,longitude:1,timezone:0};
  const db={$queryRaw:jest.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([])};const smart={prepareComputed:jest.fn().mockRejectedValue(new Error('no yoga'))};
  const worker=new SmartAstrologyWorker(db as never,smart as never);await worker.tick();await worker.tick();await worker.tick();
  expect(db.$queryRaw.mock.calls[1]).toContain('u1');expect(db.$queryRaw.mock.calls[1]).toContain('yoga');expect(db.$queryRaw.mock.calls[2]).toContain('');
 });
 it('overlapping cron ticks cannot start duplicate scans and error releases local fence',async()=>{
  enabled();let release!:()=>void;const db={$queryRaw:jest.fn().mockImplementationOnce(()=>new Promise(r=>{release=()=>r([]);})).mockResolvedValue([])};
  const worker=new SmartAstrologyWorker(db as never,{} as never);const first=worker.tick();await worker.tick();expect(db.$queryRaw).toHaveBeenCalledTimes(1);release();await first;await worker.tick();expect(db.$queryRaw).toHaveBeenCalledTimes(2);
 });
});
