jest.mock('../../infrastructure/supabase/supabase.service', () => ({SupabaseService: class {}}));
jest.mock('../notifications/notifications-identity.guard', () => ({NotificationsIdentityGuard: class {}}));
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

describe('Feedback verified Customer context (synthetic, no database writes)', () => {
  const identity = {sub:'synthetic-subject', asp_user_id:'synthetic-owner', asp_context:'customer'};
  function fixture(role='CUSTOMER', overrides={}) {
    const user={id:'synthetic-owner',isActive:true,isBlocked:false,role:{name:role},...overrides};
    const rows: any[]=[];
    const feedback={findMany:jest.fn(async()=>rows),findFirst:jest.fn(async()=>rows[0]),
      count:jest.fn(async()=>rows.length),create:jest.fn(async(input:any)=>{
        const row={id:'synthetic-feedback',...input.data}; rows.push(row); return row;
      })};
    const tx={feedback,$queryRaw:jest.fn(async()=>[]),$executeRaw:jest.fn()};
    const db={user:{findMany:jest.fn(async()=>[user])},feedback,$transaction:async(fn:any)=>fn(tx)};
    return {service:new FeedbackService(db as never),db,feedback};
  }
  it('controller preserves verified canonical and portal claims for create and history',()=>{
    const service={create:jest.fn(),getMine:jest.fn()};
    const controller=new FeedbackController(service as never);
    const dto={category:'GENERAL',message:'Synthetic valid feedback'} as never;
    controller.create(identity,dto); controller.getMine(identity,'2');
    expect(service.create).toHaveBeenCalledWith(identity,dto);
    expect(service.getMine).toHaveBeenCalledWith(identity,2);
  });
  it.each(['CUSTOMER','USER','ADMIN'])('authorized %s Customer context reads only owned history',async(role)=>{
    const f=fixture(role); await f.service.getMine(identity);
    expect(f.feedback.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{customerId:'synthetic-owner'}}));
  });
  it('does not give an Admin portal access to Customer feedback',async()=>{
    const f=fixture('ADMIN');
    await expect(f.service.getMine({...identity,asp_context:'admin'})).rejects.toThrow();
    expect(f.feedback.findMany).not.toHaveBeenCalled();
  });
  it('does not infer a Customer portal from Admin role alone',async()=>{
    await expect(fixture('ADMIN').service.getMine({sub:identity.sub})).rejects.toThrow();
  });
  it('rejects canonical-owner mismatch before querying history',async()=>{
    const f=fixture(); await expect(f.service.getMine({...identity,asp_user_id:'other-owner'})).rejects.toThrow();
    expect(f.feedback.findMany).not.toHaveBeenCalled();
  });
  it.each([{isBlocked:true},{isActive:false}])('rejects unavailable account %j',async(patch)=>{
    await expect(fixture('CUSTOMER',patch).service.getMine(identity)).rejects.toThrow();
  });
  it('does not treat an astrologer portal as a Customer portal',async()=>{
    await expect(fixture('ASTROLOGER',{astrologer:{isApproved:true}}).service.getMine({...identity,asp_context:'astrologer'})).rejects.toThrow();
  });
  it('serializes duplicate submissions into one feedback record',async()=>{
    const f=fixture('ADMIN'); const dto={category:'GENERAL',message:'Synthetic valid feedback',rating:5} as never;
    const first=await f.service.create(identity,dto); const second=await f.service.create(identity,dto);
    expect(first.data.id).toBe(second.data.id); expect(f.feedback.create).toHaveBeenCalledTimes(1);
  });
});
