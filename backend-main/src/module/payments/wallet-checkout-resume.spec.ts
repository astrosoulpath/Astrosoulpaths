import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class MockSupabaseAuthGuard {},
}));
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { getRazorpayInstance } from '../../config/razorpay.config';
jest.mock('../../config/razorpay.config', () => ({getRazorpayInstance: jest.fn()}));
describe('wallet checkout resume and public config (isolated)', () => {
 const saved={...process.env};
 afterEach(()=>{process.env={...saved};jest.restoreAllMocks();});
 function setup() {
  process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';
  const row:any={userId:'customer',type:PaymentType.WALLET_RECHARGE,status:PaymentStatus.PENDING,metadata:{providerMode:'TEST'},amount:new Prisma.Decimal(100),currency:'INR'};
  const provider:any={orders:{fetch:jest.fn().mockResolvedValue({id:'order_owned',status:'created',amount:10000,amount_paid:0,amount_due:10000,currency:'INR'}),fetchPayments:jest.fn().mockResolvedValue({items:[]})}};
  (getRazorpayInstance as jest.Mock).mockReturnValue(provider);
  const service=new PaymentsService({paymentOrder:{findUnique:jest.fn().mockResolvedValue(row)}} as any,{} as any,{} as any,{} as any,{} as any,{} as any);
  jest.spyOn(service as any,'findUserBySupabaseId').mockResolvedValue({id:'customer'});
  return {row,provider,service};
 }
 it('keeps config and resume behind existing authenticated guard',()=>{
  expect(Reflect.getMetadata('__guards__',PaymentsController.prototype.checkoutConfig)).toContain(SupabaseAuthGuard);
  expect(Reflect.getMetadata('__guards__',PaymentsController.prototype.pendingWalletOrder)).toContain(SupabaseAuthGuard);
 });
 it('returns only the public key and mode; propagates fail-closed config errors',()=>{
  process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';process.env.RAZORPAY_KEY_SECRET='private-sentinel';
  const c=new PaymentsController({} as any,{} as any);
  expect(c.checkoutConfig()).toEqual({keyId:'rzp_test_synthetic',mode:'TEST'});
  (getRazorpayInstance as jest.Mock).mockImplementationOnce(()=>{throw Error('Live disabled');});
  expect(()=>c.checkoutConfig()).toThrow('Live disabled');
 });
 it('resumes only an unpaid matching owned wallet order, without mutations',async()=>{
  const {service}=setup();expect(await service.getPendingWalletOrder('subject','order_owned')).toEqual({id:'order_owned',amount:10000,currency:'INR'});
 });
 it.each(['LIVE','UNKNOWN'])('rejects mode %s',async mode=>{
  const {row,service,provider}=setup();row.metadata.providerMode=mode;await expect(service.getPendingWalletOrder('subject','order_owned')).rejects.toThrow('reconciliation');expect(provider.orders.fetch).not.toHaveBeenCalled();
 });
 it('rejects foreign customer or wrong product before provider calls',async()=>{
  for(const values of [{userId:'foreign'},{type:PaymentType.SUBSCRIPTION}]){const {row,service,provider}=setup();Object.assign(row,values);await expect(service.getPendingWalletOrder('subject','order_owned')).rejects.toThrow('not found');expect(provider.orders.fetch).not.toHaveBeenCalled();}
 });
 it.each(['authorized','captured'])('never reopens while payment is %s',async status=>{
  const {service,provider}=setup();provider.orders.fetchPayments.mockResolvedValue({items:[{status}]});await expect(service.getPendingWalletOrder('subject','order_owned')).rejects.toThrow('reconciled');
 });
 it('rejects partial payment and provider amount/currency/order drift',async()=>{
  for(const drift of [{amount_paid:100},{amount_due:0},{amount:99},{currency:'USD'},{id:'order_other'}]){const {service,provider}=setup();provider.orders.fetch.mockResolvedValue({...await provider.orders.fetch(),...drift});await expect(service.getPendingWalletOrder('subject','order_owned')).rejects.toThrow('reconciled');}
 });
});
