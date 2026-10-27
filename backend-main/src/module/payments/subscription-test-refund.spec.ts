import { SubscriptionTestRefund } from './subscription-test-refund';
describe('isolated professional subscription refund safety',()=>{
 const saved={...process.env};
 beforeEach(()=>{process.env.SUBSCRIPTION_TEST_REFUND_ENABLED='true';process.env.SUBSCRIPTION_TEST_REFUND_DATABASE='asp_payment_operations_123456abcdef';process.env.RAZORPAY_KEY_ID='rzp_test_fixture'});
 afterEach(()=>{process.env={...saved}});
 function fixture(state='PREPARED') {
  const intent={id:'intent',state,providerPaymentId:'pay_test',razorpayOrderId:'order_test',providerRefundId:'rfnd_test'};
  const db:any={$queryRaw:jest.fn().mockResolvedValueOnce([{name:'asp_payment_operations_123456abcdef',port:16432}]).mockResolvedValue([intent]),$transaction:jest.fn(),$executeRaw:jest.fn().mockResolvedValue(1)};
  const provider={payments:{fetch:jest.fn().mockResolvedValue({status:'captured',captured:true,order_id:'order_test',amount:350000,amount_refunded:0,currency:'INR'}),fetchMultipleRefund:jest.fn().mockResolvedValue({items:[]}),refund:jest.fn()},refunds:{fetch:jest.fn()}};
  return {db,provider,service:new SubscriptionTestRefund(db,provider)};
 }
 it('is disabled by default',async()=>{const f=fixture();delete process.env.SUBSCRIPTION_TEST_REFUND_ENABLED;await expect(f.service.submit('intent')).rejects.toThrow('disabled');expect(f.provider.payments.fetch).not.toHaveBeenCalled()});
 it('rejects LIVE credentials',async()=>{const f=fixture();process.env.RAZORPAY_KEY_ID='rzp_live_fixture';await expect(f.service.submit('intent')).rejects.toThrow('disabled')});
 it('rejects the original application database',async()=>{const f=fixture();f.db.$queryRaw.mockReset().mockResolvedValue([{name:'astro_soul_path',port:5432}]);await expect(f.service.submit('intent')).rejects.toThrow('isolated');expect(f.provider.payments.fetch).not.toHaveBeenCalled()});
 it.each(['SUBMITTING','UNKNOWN','PENDING','PROCESSED','FAILED'])('never resubmits %s',async state=>{const f=fixture(state);await expect(f.service.submit('intent')).rejects.toThrow('resubmit');expect(f.provider.payments.refund).not.toHaveBeenCalled()});
 it('rejects existing provider refunds before claiming',async()=>{const f=fixture();f.provider.payments.fetchMultipleRefund.mockResolvedValue({items:[{}]});await expect(f.service.submit('intent')).rejects.toThrow('Unrefunded');expect(f.db.$transaction).not.toHaveBeenCalled()});
 it('a lost concurrent claim cannot dispatch',async()=>{const f=fixture();f.db.$transaction.mockResolvedValue(0);await expect(f.service.submit('intent')).rejects.toThrow('claimed');expect(f.provider.payments.refund).not.toHaveBeenCalled()});
 it('pending provider status does not cancel entitlement',async()=>{const f=fixture('PENDING');f.provider.refunds.fetch.mockResolvedValue({id:'rfnd_test',payment_id:'pay_test',amount:350000,currency:'INR',receipt:'intent',status:'pending'});expect(await f.service.reconcile('intent')).toEqual({state:'PENDING',alreadyProcessed:false});expect(f.db.$transaction).not.toHaveBeenCalled()});
 it('mismatched proof cannot cancel entitlement',async()=>{const f=fixture('PENDING');f.provider.refunds.fetch.mockResolvedValue({id:'rfnd_test',payment_id:'another',amount:350000,currency:'INR',receipt:'intent',status:'processed'});await expect(f.service.reconcile('intent')).rejects.toThrow('mismatch');expect(f.db.$transaction).not.toHaveBeenCalled()});
 it('uncertain submission without a matching receipt cannot dispatch or cancel',async()=>{const f=fixture('UNKNOWN');f.db.$queryRaw.mockReset().mockResolvedValueOnce([{name:'asp_payment_operations_123456abcdef',port:16432}]).mockResolvedValue([{state:'UNKNOWN',providerPaymentId:'pay_test',providerRefundId:null}]);await expect(f.service.reconcile('intent')).rejects.toThrow('never resubmit');expect(f.provider.payments.refund).not.toHaveBeenCalled();expect(f.db.$transaction).not.toHaveBeenCalled()});
});
