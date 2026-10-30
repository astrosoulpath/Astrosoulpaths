import {AstrologerService} from './astrologer.service';
describe('Correction resubmission ownership and revision fences',()=>{
 const before={...process.env};beforeEach(()=>{process.env.ADMIN_MODERATION_WRITES_ENABLED='true';process.env.ADMIN_MODERATION_SCHEMA_REVIEWED='true';process.env.ADMIN_ASTROLOGER_CORRECTIONS_READY='true';});afterEach(()=>{process.env={...before};});
 function fixture(state='NEEDS_CHANGES',version=2){
  const tx={user:{findUnique:jest.fn().mockResolvedValue({id:'owner',isActive:true,isBlocked:false})},astrologer:{findUnique:jest.fn().mockResolvedValue({id:'profile',isApproved:false,documents:{consent:{countryCode:'IN'}}}),update:jest.fn()},$queryRaw:jest.fn().mockResolvedValueOnce([{id:'owner'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{state,version,requestedFields:['bio']}]),$executeRaw:jest.fn().mockResolvedValue(1)};
  const db={userAuthIdentity:{findUnique:jest.fn().mockResolvedValue({userId:'owner'})},user:{findUnique:jest.fn().mockResolvedValue({id:'owner'})},$transaction:jest.fn(callback=>callback(tx))};
  const service=new AstrologerService(db as never,{} as never,{} as never);
  const dto={requestId:'00000000-0000-4000-8000-000000000003',expectedVersion:2,updates:{bio:'Corrected biography'},consentAccepted:true,countryCode:'IN'};
  return{db,tx,service,dto};
 }
 it('writes only requested professional fields and returns to unreviewed, never approved',async()=>{
  const f=fixture();const result=await f.service.resubmitCorrections('provider-subject',f.dto);expect(result.state).toBe('PENDING_REVIEW');expect(f.tx.astrologer.update).toHaveBeenCalledWith({where:{id:'profile'},data:expect.objectContaining({bio:'Corrected biography',isApproved:false,isVerified:false,isOnline:false})});expect(f.tx.$executeRaw).toHaveBeenCalledTimes(2);
 });
 it.each([['APPROVED',2],['NEEDS_CHANGES',3]])('rejects changed state/version %s/%s',async(state,version)=>{const f=fixture(String(state),Number(version));await expect(f.service.resubmitCorrections('subject',f.dto)).rejects.toThrow('Application changed');expect(f.tx.astrologer.update).not.toHaveBeenCalled();});
 it('rejects privilege fields even when a requested biography is present',async()=>{const f=fixture();await expect(f.service.resubmitCorrections('subject',{...f.dto,updates:{bio:'Updated',isApproved:true}})).rejects.toThrow('explicitly requested');expect(f.tx.astrologer.update).not.toHaveBeenCalled();});
 it('rejects a different country rather than rewriting consent',async()=>{const f=fixture();await expect(f.service.resubmitCorrections('subject',{...f.dto,countryCode:'US'})).rejects.toThrow('Country changes');expect(f.tx.astrologer.update).not.toHaveBeenCalled();});
 it('cannot access another applicant by accepting an ID in the body',async()=>{const f=fixture();f.db.user.findUnique.mockResolvedValue(null);await expect(f.service.resubmitCorrections('foreign',f.dto)).rejects.toThrow('not accessible');expect(f.db.$transaction).not.toHaveBeenCalled();});
 it('does not mutate the profile when the request ID belongs to another owner',async()=>{const f=fixture();f.tx.$queryRaw.mockReset().mockResolvedValueOnce([{id:'owner'}]).mockResolvedValueOnce([{actorId:'foreign',userId:'foreign',action:'RESUBMIT',details:{},version:3}]);await expect(f.service.resubmitCorrections('subject',f.dto)).rejects.toThrow('another correction');expect(f.tx.astrologer.update).not.toHaveBeenCalled();});
});
