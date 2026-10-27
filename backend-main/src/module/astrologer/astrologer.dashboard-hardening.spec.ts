import { AdminRepository } from '../admin/admin.repository';
import { AstrologerService } from './astrologer.service';
describe('astrologer dashboard persisted pending-request summary', () => {
  it('counts only own live PENDING requests with canonical User.id, never a dummy zero', async () => {
    const db: any = {
      astrologerEarning: {
        groupBy: jest.fn().mockResolvedValue([{currency: 'INR', _sum: { netAmount: 12.5 }}]),
      },
      callSession: {
        count: jest.fn(async ({ where }) =>
          where.status === 'PENDING' ? 7 : 2,
        ),
      },
      $transaction: jest.fn((values) => Promise.all(values)),
    };
    const service = new AstrologerService(db, {} as any, {} as any);
    jest
      .spyOn(service as any, 'findAstrologerBySupabaseId')
      .mockResolvedValue({
        id: 'profile',
        user: { id: 'canonical-user', name: 'Synthetic', avatarUrl: null },
        bio: 'Synthetic',
        languages: ['French'],
        expertise: [],
        pricePerMin: 10,
        documents: {},
        isApproved: true,
        isVerified: true,
        isOnline: false,
        rating: 0,
        experience: 2,
      });
    const result = await service.getDashboard('authenticated-subject');
    expect(result.data.pendingConsultations).toBe(7);
    expect(result.data.earnings).toBe(12.5);
    expect(db.callSession.count).toHaveBeenCalledWith({
      where: {
        astrologerId: 'canonical-user',
        status: 'PENDING',
        endedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
    });
    expect(
      db.callSession.count.mock.calls.every(
        ([query]) => query.where.astrologerId === 'canonical-user',
      ),
    ).toBe(true);
  });
});

describe('currency-isolated read summaries', () => {
  it.each([
    [[], null],
    [[{currency:'USD',_sum:{netAmount:0}}], 0],
    [[{currency:'USD',_sum:{netAmount:1.23}},{currency:'INR',_sum:{netAmount:70}}], null],
  ])('never adds distinct stored currencies: %j', async (rows, total) => {
    const groupBy = jest.fn().mockResolvedValue(rows);
    const db: any = { astrologerEarning: {groupBy, count: jest.fn().mockResolvedValue(2)},
      $transaction: jest.fn((queries) => Promise.all(queries)) };
    const service = new AstrologerService(db, {} as any, {} as any);
    jest.spyOn(service as any, 'findAstrologerBySupabaseId').mockResolvedValue({id:'own-profile'});
    const result = await service.getEarningsSummary('authenticated-subject');
    expect(result.data.availableBalance).toBe(total);
    expect(result.data.availableBalanceByCurrency).toEqual(rows.map(row => ({currency:row.currency,amount:row._sum.netAmount})));
    for (const [query] of groupBy.mock.calls) {
      expect(query.by).toEqual(['currency']);
      expect(query.where.astrologerId).toBe('own-profile');
    }
  });
});

describe('approval revocation between protected operations', () => {
  it.each(['isApproved', 'isVerified'])('rejects revoked %s without financial writes', async (flag) => {
    const profile: any = {id:'own-profile', isApproved:true, isVerified:true};
    const groupBy = jest.fn().mockResolvedValue([]);
    const db: any = {userAuthIdentity:{findUnique:jest.fn().mockResolvedValue({userId:'canonical'})},
      user:{findUnique:jest.fn().mockResolvedValue({id:'canonical',isActive:true,isBlocked:false,isAstrologer:true})},
      astrologer:{findUnique:jest.fn().mockResolvedValue(profile)},
      astrologerEarning:{groupBy,count:jest.fn().mockResolvedValue(0)},
      $transaction:jest.fn((queries) => Promise.all(queries))};
    const service = new AstrologerService(db, {} as any, {} as any);
    await service.getEarningsSummary('authenticated');
    profile[flag] = false;
    groupBy.mockClear();
    await expect(service.getEarningsSummary('authenticated')).rejects.toThrow('Admin approval');
    expect(groupBy).not.toHaveBeenCalled();
  });
});

describe('Admin financial read currency isolation', () => {
  it('exposes collections per currency with no unqualified mixed total', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      {currency:'INR',_sum:{amount:70},_avg:{amount:35},_count:{id:2}},
      {currency:'USD',_sum:{amount:1},_avg:{amount:1},_count:{id:1}},
    ]);
    const result = await new AdminRepository({paymentOrder:{groupBy}} as any).getRevenueSummary();
    expect(result.totalRevenue).toBeNull();
    expect(result.successfulPaymentCollections).toBeNull();
    expect(result.successfulPayments).toBe(3);
    expect(result.collectionsByCurrency.map(row => row.currency)).toEqual(['INR','USD']);
    expect(groupBy.mock.calls[0][0].by).toEqual(['currency']);
  });
});

describe('Admin dashboard mixed currency totals', () => {
  it('sums counts but never money across currencies', async () => {
    const groupBy=jest.fn().mockResolvedValue([
      {currency:'USD',_sum:{amount:1,balance:1,lockedBalance:0},_avg:{amount:1},_count:{id:1}},
      {currency:'INR',_sum:{amount:70,balance:70,lockedBalance:0},_avg:{amount:70},_count:{id:1}},
    ]);
    const model={count:jest.fn().mockResolvedValue(2),groupBy};
    const result=await new AdminRepository({user:model,astrologer:model,callSession:model,paymentOrder:model,wallet:model,review:model} as any).getDashboardStats();
    expect(result.payments.successfulOrders).toBe(2);
    expect(result.payments.successfulAmount).toBeNull();
    expect(result.wallets.totalBalance).toBeNull();
    expect(result.wallets.totalBalanceByCurrency).toEqual([{currency:'USD',amount:1},{currency:'INR',amount:70}]);
  });
});

describe('weekly availability valid clock bounds', () => {
  it.each(['24:00','09:60','99:99'])('rejects invalid clock value %s before persistence',async(startTime)=>{
    const db:any={$transaction:jest.fn()};
    const service=new AstrologerService(db,{} as any,{} as any);
    jest.spyOn(service as any,'findAstrologerBySupabaseId').mockResolvedValue({id:'synthetic',isApproved:true,isVerified:true});
    await expect(service.updateAvailability('synthetic',{timezone:'Asia/Kolkata',days:[{dayOfWeek:1,isEnabled:true,startTime,endTime:'23:59'}]})).rejects.toThrow('HH:mm');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
