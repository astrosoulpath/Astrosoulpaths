import { customerWhere } from './admin-customer-query';
import { AdminRepository } from './admin.repository';
import { astrologerWhere } from './admin-astrologer-query';

describe('Admin astrologer server search', () => {
  it('searches names, language, expertise and canonical IDs rather than provider IDs', () => {
    const where = astrologerWhere({search:'Synthetic',approval:'APPROVED',onlineOnly:true});
    expect(where.isApproved).toBe(true);expect(where.isOnline).toBe(true);
    expect(where.OR).toHaveLength(8);
    expect(JSON.stringify(where)).not.toContain('supabaseId');
  });
  it('uses matching filters for pages and totals', async () => {
    const astrologer={findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(45)};
    const result=await new AdminRepository({astrologer} as never).findAstrologers({page:3,limit:20,search:'Synthetic'});
    const query=astrologer.findMany.mock.calls[0][0];
    expect(query.skip).toBe(40);expect(astrologer.count).toHaveBeenCalledWith({where:query.where});
    expect(result.pagination.totalPages).toBe(3);
  });
  it('rejects unrecorded moderation states and oversized searches', () => {
    expect(()=>astrologerWhere({approval:'SUSPENDED'})).toThrow();
    expect(()=>astrologerWhere({search:'x'.repeat(101)})).toThrow();
  });
});

describe('Admin customer pagination and minimization', () => {
  it('filters canonical CUSTOMER before pagination and returns database totals beyond 100', async () => {
    const user = {findMany: jest.fn().mockResolvedValue([{id:'synthetic-151'}]), count: jest.fn().mockResolvedValue(201)};
    const repository = new AdminRepository({user} as never);
    const result = await repository.findUsers({customerOnly:true,page:6,limit:20,search:'Synthetic',status:'ACTIVE'});
    const query = user.findMany.mock.calls[0][0];
    expect(query.skip).toBe(100); expect(query.take).toBe(20);
    expect(query.where).toEqual(customerWhere('Synthetic','ACTIVE'));
    expect(user.count).toHaveBeenCalledWith({where:query.where});
    expect(result.pagination).toEqual({page:6,limit:20,total:201,totalPages:11});
    expect(query.select.supabaseId).toBeUndefined();
    expect(query.select.userProfile).toEqual({select:{fullName:true,avatarUrl:true}});
    expect(query.orderBy).toEqual([{createdAt:'desc'},{id:'asc'}]);
  });
  it.each(['ALL','ACTIVE','BLOCKED','WITH_WALLET','WITHOUT_WALLET'])('preserves role restriction for %s', status => {
    const where = customerWhere('test',status);
    expect(where.AND![0]).toEqual({role:{name:{equals:'CUSTOMER',mode:'insensitive'}}});
  });
  it('rejects unknown filters and excessive search without querying', () => {
    expect(()=>customerWhere('', 'ADMIN')).toThrow('Invalid customer status');
    expect(()=>customerWhere('x'.repeat(201))).toThrow('Search is too long');
  });
  it('keeps ordinary user listing compatible and caps page size', async () => {
    const user = {findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(0)};
    await new AdminRepository({user} as never).findUsers({page:1,limit:1000});
    expect(user.findMany.mock.calls[0][0].take).toBe(100);
    expect(user.findMany.mock.calls[0][0].where).toEqual({});
  });
});
