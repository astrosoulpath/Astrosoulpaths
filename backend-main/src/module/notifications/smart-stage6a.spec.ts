import { SmartNotificationsWorker } from './smart-notifications.worker';
describe('Stage6A long-interval frequency protection',()=>{
 const original={...process.env};afterEach(()=>{process.env={...original};});
 it.each([72*3600000,2147483647])('looks back over the entire configured interval %d and does not send early',async interval=>{
  for(const key of ['SMART_NOTIFICATIONS_SCHEMA_READY','SMART_NOTIFICATIONS_DELIVERY_ENABLED','SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED'])process.env[key]='true';
  const now=new Date(),hour=(now.getUTCHours()+2)%24;
  const row={id:'insight',category:'love',locale:'en',expiresAt:new Date(Date.now()+86400000),consentExpiry:new Date(Date.now()+86400000),version:1,consentVersion:1,revision:1,policyRevision:1,provenance:'LOCAL_COMPUTED',granted:true,birthUse:true,approved:true,enabled:true,languages:['en'],isActive:true,isBlocked:false,entitlement:'FREE_APPROVED',lang:'en',timezone:'UTC',dailyLimit:2,minimumIntervalMs:interval,quietStart:hour*60,quietEnd:hour*60+30};
  const tx={$queryRaw:jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([{attemptedAt:new Date(Date.now()-60*3600000)}]),$executeRaw:jest.fn()};
  const db={$transaction:jest.fn(fn=>fn(tx)),$executeRaw:jest.fn()};const push={sendToUser:jest.fn()};
  await (new SmartNotificationsWorker(db as never,push as never) as any).deliver({id:'job',userId:'owner',insightId:'insight',attempts:0,leaseToken:'lease'});
  expect(tx.$queryRaw.mock.calls[2]).toContain(interval);expect(push.sendToUser).not.toHaveBeenCalled();expect(db.$executeRaw.mock.calls[0]).toContain('FREQUENCY_DEFERRED');
 });
});
