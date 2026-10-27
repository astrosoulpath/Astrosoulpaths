jest.mock('../../config/razorpay.config',()=>({getRazorpayInstance:jest.fn()}));
import { Prisma } from '@prisma/client';
import { getRazorpayInstance } from '../../config/razorpay.config';
import { PaymentsService } from './payments.service';
describe('owned pending subscription checkout resume',()=>{
 const original={...process.env};
 beforeEach(()=>{process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED='true'});
 afterEach(()=>{process.env={...original};jest.clearAllMocks()});
 function fixture(){
  const row:any={userId:'owner',type:'SUBSCRIPTION',status:'PENDING',amount:new Prisma.Decimal(3500),currency:'INR',metadata:{providerMode:'TEST',subscriptionId:'sub'}};
  const subscription:any={id:'sub',amount:new Prisma.Decimal(3500),currency:'INR',subscriptionPlan:{name:'ASTROLOGER_KUNDLI_YEARLY',price:new Prisma.Decimal(3500),currency:'INR',durationDays:365,isActive:true}};
  const provider:any={orders:{fetch:jest.fn().mockResolvedValue({id:'order_existing',amount:350000,amount_paid:0,amount_due:350000,currency:'INR',status:'created'}),fetchPayments:jest.fn().mockResolvedValue({items:[]}),create:jest.fn()}};
  (getRazorpayInstance as jest.Mock).mockReturnValue(provider);
  const service:any=Object.create(PaymentsService.prototype);service.findUserBySupabaseId=jest.fn().mockResolvedValue({id:'owner',isAstrologer:true});
  service.prisma={paymentOrder:{findUnique:jest.fn().mockResolvedValue(row)},subscription:{findFirst:jest.fn().mockResolvedValue(subscription)},astrologer:{findUnique:jest.fn().mockResolvedValue({isApproved:true,isVerified:true})}};
  return {row,subscription,provider,service};
 }
 it('returns the existing unpaid order without creating another provider order',async()=>{const f=fixture();expect(await f.service.getPendingSubscriptionOrder('subject','order_existing')).toEqual({id:'order_existing',amount:350000,currency:'INR'});expect(f.provider.orders.create).not.toHaveBeenCalled()});
 it('rejects cross-account access before contacting the provider',async()=>{const f=fixture();f.row.userId='another';await expect(f.service.getPendingSubscriptionOrder('subject','order_existing')).rejects.toThrow('not found');expect(getRazorpayInstance).not.toHaveBeenCalled()});
 it.each(['UNKNOWN','LIVE'])('does not relabel or resume %s records with TEST credentials',async mode=>{const f=fixture();f.row.metadata.providerMode=mode;await expect(f.service.getPendingSubscriptionOrder('subject','order_existing')).rejects.toThrow('reconciliation');expect(getRazorpayInstance).not.toHaveBeenCalled()});
 it('requires the same pending subscription binding',async()=>{const f=fixture();f.row.metadata.subscriptionId='other';await expect(f.service.getPendingSubscriptionOrder('subject','order_existing')).rejects.toThrow('binding')});
 it('rechecks astrologer approval',async()=>{const f=fixture();f.service.prisma.astrologer.findUnique.mockResolvedValue({isApproved:false,isVerified:true});await expect(f.service.getPendingSubscriptionOrder('subject','order_existing')).rejects.toThrow('Approved')});
 it.each(['authorized','captured'])('refuses a new checkout while a payment is %s',async status=>{const f=fixture();f.provider.orders.fetchPayments.mockResolvedValue({items:[{status}]});await expect(f.service.getPendingSubscriptionOrder('subject','order_existing')).rejects.toThrow('reconciled')});
 it('rejects provider amount drift',async()=>{const f=fixture();f.provider.orders.fetch.mockResolvedValue({id:'order_existing',amount:300000,amount_paid:0,amount_due:300000,currency:'INR',status:'created'});await expect(f.service.getPendingSubscriptionOrder('subject','order_existing')).rejects.toThrow('reconciled')});
});
