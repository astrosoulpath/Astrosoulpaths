import { randomUUID } from 'node:crypto';
import { SmartNotificationsService } from './smart-notifications.service';

describe('Admin draft concurrency and schema contracts', () => {
  const previous=process.env.SMART_NOTIFICATIONS_SCHEMA_READY;
  afterEach(()=>{if(previous===undefined)delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY;else process.env.SMART_NOTIFICATIONS_SCHEMA_READY=previous;});
  function setup(){
    process.env.SMART_NOTIFICATIONS_SCHEMA_READY='true';
    const tx={$queryRaw:jest.fn(),$executeRaw:jest.fn().mockResolvedValue(1)};
    const db={...tx,$transaction:jest.fn(fn=>fn(tx))};
    return {tx,db,service:new SmartNotificationsService(db as never,{} as never)};
  }
  const input=()=>({category:'love',locale:'en',title:'Thoughtful reflection',body:'Make time for a kind conversation.',expiresAt:new Date(Date.now()+86400000).toISOString()});
  it('schema readiness distinguishes missing tables from a disabled gate without granting access',async()=>{
    const {db,service}=setup();delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY;db.$queryRaw.mockResolvedValue([]);
    const result=await service.storageReadiness();expect(result.data.schemaGateEnabled).toBe(false);expect(result.data.tablesReady).toBe(false);expect(result.data.missingTables).toHaveLength(7);
    await expect(service.listCampaigns()).rejects.toThrow('not activated');expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('edits the locked current DRAFT and appends one audit without content values',async()=>{
    const {tx,service}=setup();tx.$queryRaw.mockResolvedValueOnce([{state:'DRAFT',revision:2}]).mockResolvedValueOnce([{category:'love'}]);
    const result=await service.editDraft('synthetic-admin',randomUUID(),{...input(),revision:2});expect(result.data.revision).toBe(3);
    expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw.mock.calls[1][0].join('')).toContain('DRAFT_EDITED');expect(JSON.stringify(tx.$executeRaw.mock.calls[1])).not.toContain('Thoughtful reflection');
  });
  it.each(['APPROVED','SCHEDULED','PAUSED'])('cannot edit %s content',async state=>{
    const {tx,service}=setup();tx.$queryRaw.mockResolvedValue([{state,revision:1}]);
    await expect(service.editDraft('synthetic-admin',randomUUID(),{...input(),revision:1})).rejects.toThrow('current draft');expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('stale revision cannot win an edit/approval race',async()=>{const {tx,service}=setup();tx.$queryRaw.mockResolvedValue([{state:'DRAFT',revision:2}]);await expect(service.editDraft('synthetic-admin',randomUUID(),{...input(),revision:1})).rejects.toThrow('current draft');expect(tx.$executeRaw).not.toHaveBeenCalled();});
  it.each([null,'not-a-uuid'])('rejects invalid request id %s before transaction',async requestId=>{const {db,service}=setup();await expect(service.createCampaign('synthetic-admin',{...input(),requestId:requestId as never})).rejects.toThrow('identifier');expect(db.$transaction).not.toHaveBeenCalled();});
  it('same create request returns existing result without duplicate audit',async()=>{
    const {tx,service}=setup(),value=input(),id=randomUUID();tx.$queryRaw.mockResolvedValueOnce([{category:'love'}]).mockResolvedValueOnce([{...value,id,createdBy:'synthetic-admin',expiresAt:new Date(value.expiresAt),state:'DRAFT',revision:1}]);tx.$executeRaw.mockResolvedValue(0);
    expect((await service.createCampaign('synthetic-admin',{...value,requestId:id})).data.id).toBe(id);expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('request id owned by another actor cannot be reused or reveal content',async()=>{
    const {tx,service}=setup();tx.$queryRaw.mockResolvedValueOnce([{category:'love'}]).mockResolvedValueOnce([{createdBy:'foreign'}]);tx.$executeRaw.mockResolvedValue(0);
    await expect(service.createCampaign('synthetic-admin',{...input(),requestId:randomUUID()})).rejects.toThrow('Draft request changed');expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('schema off prevents draft edit before transaction',async()=>{const {db,service}=setup();delete process.env.SMART_NOTIFICATIONS_SCHEMA_READY;await expect(service.editDraft('synthetic-admin',randomUUID(),{...input(),revision:1})).rejects.toThrow('not activated');expect(db.$transaction).not.toHaveBeenCalled();});
  it('missing campaign has no fabricated zero-delivery status',async()=>{const {db,service}=setup();db.$queryRaw.mockResolvedValue([]);await expect(service.campaignStatus(randomUUID())).rejects.toThrow('Campaign unavailable');expect(db.$queryRaw).toHaveBeenCalledTimes(1);});
  it.each(['approve','schedule'])('expired campaign cannot %s',async action=>{const {tx,service}=setup();tx.$queryRaw.mockResolvedValue([{state:action==='approve'?'DRAFT':'APPROVED',revision:1,expiresAt:new Date(0)}]);await expect(service.transition('synthetic-admin',randomUUID(),{action,revision:1,contentPolicyReviewed:true,scheduledAt:new Date(Date.now()+60000).toISOString()})).rejects.toThrow();expect(tx.$executeRaw).not.toHaveBeenCalled();});
});
