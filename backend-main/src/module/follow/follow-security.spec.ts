import { FollowService } from './follow.service';
import { FollowController } from './follow.controller';
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({ SupabaseJwtService: class {} }));

describe('canonical customer follows (mocked; no database)', () => {
  function setup() {
    const links = new Set<string>();
    const customer = {id:'customer',isActive:true,isBlocked:false,role:{name:'CUSTOMER'}};
    const target = {id:'astro',userId:'astrologer-user',isApproved:true,user:{isActive:true,isBlocked:false}};
    const db = {
      userAuthIdentity:{findUnique:jest.fn().mockResolvedValue({userId:customer.id})},
      user:{findUnique:jest.fn().mockImplementation(async()=>customer)},
      astrologer:{findUnique:jest.fn().mockImplementation(async()=>target)},
      astrologerFollow:{
        upsert:jest.fn().mockImplementation(async({create})=>{links.add(create.followerId+':'+create.astrologerId);return create;}),
        deleteMany:jest.fn().mockImplementation(async({where})=>{links.delete(where.followerId+':'+where.astrologerId);return {count:1};}),
        count:jest.fn().mockImplementation(async()=>links.size),
        findUnique:jest.fn().mockImplementation(async()=>links.size?{id:'link'}:null),
      },
      $transaction:jest.fn().mockImplementation(async queries=>Promise.all(queries)),
    };
    return {db,customer,target,service:new FollowService(db as never)};
  }
  it('uses authoritative identity mapping, not an external subject as userId', async()=>{
    const {service,db}=setup();const result=await service.followReal('verified-subject','astro');
    expect(result).toEqual({astrologerId:'astro',followerCount:1,isFollowing:true});
    expect(db.astrologerFollow.upsert.mock.calls[0][0].create.followerId).toBe('customer');
  });
  it('repeated and concurrent requests retain one canonical relationship',async()=>{
    const {service,db}=setup();await Promise.all(Array.from({length:8},()=>service.followReal('subject','astro')));
    expect(await service.realStatus('subject','astro')).toMatchObject({followerCount:1,isFollowing:true});
    expect(db.astrologerFollow.upsert.mock.calls.every(([q])=>q.update&&Object.keys(q.update).length===0)).toBe(true);
  });
  it('unfollow is scoped to the canonical owner and repeat-safe',async()=>{
    const {service,db}=setup();await service.followReal('subject','astro');await service.unfollowReal('subject','astro');
    expect(await service.unfollowReal('subject','astro')).toMatchObject({followerCount:0,isFollowing:false});
    expect(db.astrologerFollow.deleteMany).toHaveBeenCalledWith({where:{followerId:'customer',astrologerId:'astro'}});
  });
  it('a unique-key race succeeds only for the same existing ownership key, without insert retry',async()=>{
    const {service,db}=setup();db.astrologerFollow.upsert.mockRejectedValue({code:'P2002'});
    db.astrologerFollow.findUnique.mockResolvedValue({id:'canonical-link'});
    await expect(service.followReal('subject','astro')).resolves.toMatchObject({isFollowing:true});
    expect(db.astrologerFollow.upsert).toHaveBeenCalledTimes(1);
    db.astrologerFollow.findUnique.mockResolvedValue(null);
    await expect(service.followReal('subject','astro')).rejects.toEqual({code:'P2002'});
  });
  it.each(['blocked','inactive','legacy-admin'])('rejects %s before any insert',async kind=>{
    const {service,db,customer}=setup();if(kind==='blocked')customer.isBlocked=true;if(kind==='inactive')customer.isActive=false;if(kind==='legacy-admin')customer.role.name='ADMIN';
    await expect(service.followReal('subject','astro')).rejects.toThrow('Customer');expect(db.astrologerFollow.upsert).not.toHaveBeenCalled();
  });
  it('preserves a verified customer context for a canonical Admin without changing its role',async()=>{
    const {service,customer}=setup();customer.role.name='ADMIN';await expect(service.followReal('subject','astro',true)).resolves.toMatchObject({isFollowing:true});expect(customer.role.name).toBe('ADMIN');
  });
  it('rejects self-follow and unapproved/disabled target accounts',async()=>{
    const {service,db,target}=setup();target.userId='customer';await expect(service.followReal('subject','astro',true)).rejects.toThrow('Self');
    target.userId='other';target.isApproved=false;await expect(service.followReal('subject','astro')).rejects.toThrow('available');
    target.isApproved=true;target.user.isBlocked=true;await expect(service.followReal('subject','astro')).rejects.toThrow('available');expect(db.astrologerFollow.upsert).not.toHaveBeenCalled();
  });
  it('does not create an account when mapping is missing',async()=>{
    const {service,db}=setup();db.userAuthIdentity.findUnique.mockResolvedValue(null);db.user.findUnique.mockResolvedValue(null);
    await expect(service.followReal('missing','astro')).rejects.toThrow('not found');expect(db.astrologerFollow.upsert).not.toHaveBeenCalled();
  });
  it.each(['admin','astrologer'])('controller rejects signed %s context before persistence',kind=>{
    const {service,db}=setup();const controller=new FollowController(service);
    expect(()=>controller.followReal({sub:'subject',asp_context:kind,asp_account_role:'ADMIN'},'astro')).toThrow('Customer context');expect(db.astrologerFollow.upsert).not.toHaveBeenCalled();
  });
});
