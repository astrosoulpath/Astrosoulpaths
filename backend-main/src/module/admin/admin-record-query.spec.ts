import { paymentWhere, subscriptionWhere } from './admin-record-query';
import { AdminRepository } from './admin.repository';

describe('Read-only Admin record filters', () => {
  it('filters payments by verified stored status and order reference', () => {
    const where=paymentWhere('synthetic-order','SUCCESS');
    expect(where.status).toBe('SUCCESS');expect(where.OR).toHaveLength(7);
    expect(JSON.stringify(where)).toContain('razorpayOrderId');
  });
  it('filters subscriptions by canonical status and plan', () => {
    const where=subscriptionWhere('Professional','ACTIVE');
    expect(where.subscriptionStatus).toBe('ACTIVE');expect(where.OR).toHaveLength(7);
    expect(JSON.stringify(where)).toContain('subscriptionPlan');
  });
  it.each([paymentWhere,subscriptionWhere])('rejects unknown status and oversized search before querying', build => {
    expect(()=>build('', 'NOT_REAL')).toThrow();
    expect(()=>build('x'.repeat(101),'ALL')).toThrow();
    expect(build('','ALL')).toEqual({});
  });
  it('payment page and count use identical filters without mutations', async () => {
    const paymentOrder={findMany:jest.fn().mockResolvedValue([]),count:jest.fn().mockResolvedValue(21)};
    const result=await new AdminRepository({paymentOrder} as never).findPaymentOrders({page:2,limit:20,search:'Synthetic'});
    const query=paymentOrder.findMany.mock.calls[0][0];expect(query.skip).toBe(20);expect(query.orderBy).toEqual([{createdAt:'desc'},{id:'desc'}]);
    expect(paymentOrder.count).toHaveBeenCalledWith({where:query.where});
    expect(result.pagination.totalPages).toBe(2);
  });
});
