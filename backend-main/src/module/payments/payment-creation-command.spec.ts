import { paymentCreationEnabled,PaymentCreationCommands } from './payment-creation-command';
import { commissionAuditEnabled,financialLifecycleEnabled } from '../../common/finance/consultation-financial-policy';
describe('operational schema gates',()=>{
 const env={...process.env};afterEach(()=>{process.env={...env};});
 it('requested durable commands cannot silently fall back when schema is absent',()=>{process.env.PAYMENT_CREATION_COMMANDS_ENABLED='true';delete process.env.PAYMENT_CREATION_SCHEMA_READY;expect(()=>paymentCreationEnabled()).toThrow('schema');});
 it.each(['production','live'])('%s checkout cannot use the legacy fallback',target=>{
  process.env.NODE_ENV=target==='production'?'production':'test';
  process.env.RAZORPAY_KEY_ID=target==='live'?'rzp_live_synthetic':'rzp_test_synthetic';
  process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED='true';process.env.RAZORPAY_WEBHOOK_SECRET='synthetic-webhook-secret';
  for(const flags of [[false,false],[true,false],[false,true]]){
   process.env.PAYMENT_CREATION_SCHEMA_READY=String(flags[0]);
   process.env.PAYMENT_CREATION_COMMANDS_ENABLED=String(flags[1]);
   expect(()=>paymentCreationEnabled()).toThrow();
  }
  process.env.PAYMENT_CREATION_SCHEMA_READY='true';process.env.PAYMENT_CREATION_COMMANDS_ENABLED='true';
  expect(paymentCreationEnabled()).toBe(true);
 });
 it('LIVE creation rejects missing webhook configuration or approval even with durable gates',()=>{
  process.env.RAZORPAY_KEY_ID='rzp_live_synthetic';
  process.env.PAYMENT_CREATION_SCHEMA_READY='true';process.env.PAYMENT_CREATION_COMMANDS_ENABLED='true';
  process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED='true';delete process.env.RAZORPAY_WEBHOOK_SECRET;
  expect(()=>paymentCreationEnabled()).toThrow('webhook');
  process.env.RAZORPAY_WEBHOOK_SECRET='synthetic-webhook-secret';delete process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED;
  expect(()=>paymentCreationEnabled()).toThrow('approved LIVE');
 });
 it('preserves development TEST compatibility without activating durable commands',()=>{
  process.env.NODE_ENV='development';process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';
  delete process.env.PAYMENT_CREATION_SCHEMA_READY;delete process.env.PAYMENT_CREATION_COMMANDS_ENABLED;
  expect(paymentCreationEnabled()).toBe(false);
 });
 it('commission audit can operate without enabling financial lifecycle',()=>{process.env.FINANCIAL_SCHEMA_READY='true';delete process.env.FINANCIAL_LIFECYCLE_V2_ENABLED;expect(commissionAuditEnabled()).toBe(true);expect(financialLifecycleEnabled()).toBe(false);});
 it('invalid quote cannot acquire a command',async()=>{process.env.PAYMENT_CREATION_COMMANDS_ENABLED='true';process.env.PAYMENT_CREATION_SCHEMA_READY='true';process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';const db:any={$transaction:jest.fn()};await expect(new PaymentCreationCommands(db).reserve({userId:'synthetic',purpose:'subscription',reference:'synthetic',amountMinor:1.5,currency:'INR'})).rejects.toThrow('quote');expect(db.$transaction).not.toHaveBeenCalled();});
});
