jest.mock('../../config/razorpay.config',()=>({getRazorpayInstance:jest.fn()}));
import { getRazorpayInstance } from '../../config/razorpay.config';
import { MarketplaceTestRefund } from './marketplace-test-refund';
import { MarketplaceRefundWorkflow } from './marketplace-refund-workflow';
describe('isolated genuine-provider refund dispatcher',()=>{
 const env={...process.env};
 beforeEach(()=>{process.env.MARKETPLACE_TEST_REFUND_EXECUTION_ENABLED='true';process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED='true';process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';process.env.MARKETPLACE_REFUND_POLICY_APPROVED='true';process.env.MARKETPLACE_REFUND_POLICY_REVISION='synthetic-only';});
 afterEach(()=>{jest.restoreAllMocks();process.env={...env};});
 function fixture(database='asp_payment_operations_123456abcdef') {
  const intent={id:'attempt',caseId:'case',providerPaymentId:'pay_synthetic',providerOrderId:'order_synthetic',policyRevision:'synthetic-only',amountMinor:10000n,currency:'INR',componentSnapshot:{version:1,allocations:[{sellerOrderId:'seller',productMinor:10000,shippingMinor:0,taxMinor:0,feeMinor:0,discountMinor:0,currency:'INR'}]}};
  const db:any={$queryRaw:jest.fn().mockResolvedValueOnce([{name:database,port:16432}]).mockResolvedValueOnce([intent]),$executeRaw:jest.fn().mockResolvedValue(1),marketplaceCaseEvent:{create:jest.fn()}};
  const provider:any={payments:{fetch:jest.fn().mockResolvedValue({id:'pay_synthetic',order_id:'order_synthetic',status:'captured',currency:'INR',amount:10000,amount_refunded:0}),refund:jest.fn().mockResolvedValue({id:'rfnd_synthetic'})},refunds:{fetch:jest.fn()}};
  (getRazorpayInstance as jest.Mock).mockReturnValue(provider);
  return {db,provider,service:new MarketplaceTestRefund(db)};
 }
 it('cannot submit against the shared application database',async()=>{
  const f=fixture('astro_soul_path');await expect(f.service.submit('attempt','admin')).rejects.toThrow('designated disposable');expect(f.provider.payments.refund).not.toHaveBeenCalled();
 });
 it('cannot use LIVE credentials even with enabled test flags',async()=>{
  const f=fixture();process.env.RAZORPAY_KEY_ID='rzp_live_synthetic';await expect(f.service.submit('attempt','admin')).rejects.toThrow('not activated');expect(f.db.$queryRaw).not.toHaveBeenCalled();
 });
 it('cannot submit an authorized but uncaptured payment',async()=>{
  const f=fixture();f.provider.payments.fetch.mockResolvedValue({id:'pay_synthetic',order_id:'order_synthetic',status:'authorized',currency:'INR',amount:10000,amount_refunded:0});
  await expect(f.service.submit('attempt','admin')).rejects.toThrow('Captured TEST');expect(f.provider.payments.refund).not.toHaveBeenCalled();
 });
 it('cannot duplicate an already claimed refund',async()=>{
  const f=fixture();jest.spyOn(MarketplaceRefundWorkflow.prototype,'claim').mockResolvedValue(null);
  await expect(f.service.submit('attempt','admin')).rejects.toThrow('already claimed');expect(f.provider.payments.refund).not.toHaveBeenCalled();
 });
 it('uses approved intent amount and preserves provider reference before journal proof',async()=>{
  const f=fixture();jest.spyOn(MarketplaceRefundWorkflow.prototype,'claim').mockResolvedValue({id:'attempt',leaseToken:'fence'} as any);
  jest.spyOn(MarketplaceRefundWorkflow.prototype,'reconcileAndPost').mockResolvedValue({financialJournalPosted:true} as any);
  const result=await f.service.submit('attempt','admin');
  expect(f.provider.payments.refund).toHaveBeenCalledWith('pay_synthetic',expect.objectContaining({amount:10000,receipt:'attempt'}));
  expect(result.data.bankSettlementVerified).toBe(false);
  expect(f.db.$executeRaw.mock.calls.some((args:any[])=>args[0].join('').includes("state='SUCCEEDED'"))).toBe(true);
 });
 it('uncertain provider errors cannot auto-resubmit or post a journal',async()=>{
  const f=fixture();jest.spyOn(MarketplaceRefundWorkflow.prototype,'claim').mockResolvedValue({id:'attempt',leaseToken:'fence'} as any);
  const post=jest.spyOn(MarketplaceRefundWorkflow.prototype,'reconcileAndPost');f.provider.payments.refund.mockRejectedValue(new Error('synthetic timeout'));
  await expect(f.service.submit('attempt','admin')).rejects.toThrow('Do not submit another');
  expect(f.provider.payments.refund).toHaveBeenCalledTimes(1);expect(post).not.toHaveBeenCalled();
  expect(f.db.$executeRaw.mock.calls.some((args:any[])=>args[0].join('').includes("state='UNKNOWN'"))).toBe(true);
 });
});
