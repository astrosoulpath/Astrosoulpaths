jest.mock('firebase-admin/auth', () => ({getAuth: jest.fn()}));
jest.mock('../../common/guards/supabase-auth.guard', () => ({SupabaseAuthGuard: class {}}));
jest.mock('../user/user.service', () => ({UserService: class {}}));
jest.mock('./consultation.service', () => ({ConsultationService: class {}}));
import { ConsultationRepository } from './consultation.repository';
import { ConsultationController } from './consultation.controller';

describe('Customer History data boundary', () => {
  it('resolves the verified external subject to canonical ownership, never a supplied customer id', async () => {
    const service = {getAstrologerConsultationHistory:jest.fn().mockResolvedValue({success:true,data:[]})};
    const users = {findBySupabaseId:jest.fn().mockResolvedValue({id:'canonical'})};
    const controller = new ConsultationController(service as never, users as never);
    await controller.getAstrologerConsultationHistory({user:{sub:'verified-subject'}} as never,1,20,'name','audio','ENDED');
    expect(users.findBySupabaseId).toHaveBeenCalledWith('verified-subject');
    expect(service.getAstrologerConsultationHistory).toHaveBeenCalledWith('canonical',{page:1,limit:20,search:'name',mode:'audio',status:'ENDED'});
  });
  it('rejects missing authentication before a history query', async () => {
    const service = {getAstrologerConsultationHistory:jest.fn()};
    const controller = new ConsultationController(service as never, {} as never);
    await expect(controller.getAstrologerConsultationHistory({} as never,1,20)).rejects.toThrow('identity');
    expect(service.getAstrologerConsultationHistory).not.toHaveBeenCalled();
  });
  function setup() {
    const db = {callSession: {findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0)}};
    return {db, repository: new ConsultationRepository(db as never)};
  }
  it.each(['chat','audio','video'])('scopes %s list and count to the authenticated astrologer with bounded pagination', async mode => {
    const {db,repository} = setup();
    const result = await repository.findAstrologerConsultationHistory('canonical-astrologer',{page:2,limit:10,search:' Customer ',mode,status:'completed'});
    const query = db.callSession.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({astrologerId:'canonical-astrologer',mode:{equals:mode},status:{equals:'COMPLETED'}});
    expect(db.callSession.count).toHaveBeenCalledWith({where:query.where});
    expect(query.skip).toBe(10);expect(query.take).toBe(10);
    expect(query.orderBy).toEqual([{createdAt:'desc'},{id:'desc'}]);
    expect(query.select.user.select).toEqual({id:true,name:true,userProfile:{select:{fullName:true}}});
    expect(query.select.earning.select).toEqual({netAmount:true,currency:true,status:true});
    expect(query.select.messages).toBeUndefined();
    expect(query.select.channelName).toBeUndefined();
    expect(result.pagination.total).toBe(0);
  });
  it.each([{mode:'other'},{status:'anything'},{search:'a'.repeat(101)},{search:['a']}])('rejects malformed filters before database reads %j',async params=>{
    const {db,repository}=setup();
    await expect(repository.findAstrologerConsultationHistory('astro',params as never)).rejects.toThrow('Invalid history filters');
    expect(db.callSession.findMany).not.toHaveBeenCalled();
  });
  it('never reuses another astrologer ownership predicate', async()=>{
    const {db,repository}=setup();
    await repository.findAstrologerConsultationHistory('first');
    await repository.findAstrologerConsultationHistory('second');
    expect(db.callSession.findMany.mock.calls.map(call=>call[0].where.astrologerId)).toEqual(['first','second']);
  });
});
