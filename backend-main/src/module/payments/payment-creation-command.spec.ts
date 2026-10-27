import { paymentCreationEnabled,PaymentCreationCommands } from './payment-creation-command';
import { commissionAuditEnabled,financialLifecycleEnabled } from '../../common/finance/consultation-financial-policy';
describe('operational schema gates',()=>{
 const env={...process.env};afterEach(()=>{process.env={...env};});
 it('requested durable commands cannot silently fall back when schema is absent',()=>{process.env.PAYMENT_CREATION_COMMANDS_ENABLED='true';delete process.env.PAYMENT_CREATION_SCHEMA_READY;expect(()=>paymentCreationEnabled()).toThrow('schema');});
 it('commission audit can operate without enabling financial lifecycle',()=>{process.env.FINANCIAL_SCHEMA_READY='true';delete process.env.FINANCIAL_LIFECYCLE_V2_ENABLED;expect(commissionAuditEnabled()).toBe(true);expect(financialLifecycleEnabled()).toBe(false);});
 it('invalid quote cannot acquire a command',async()=>{process.env.PAYMENT_CREATION_COMMANDS_ENABLED='true';process.env.PAYMENT_CREATION_SCHEMA_READY='true';process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';const db:any={$transaction:jest.fn()};await expect(new PaymentCreationCommands(db).reserve({userId:'synthetic',purpose:'subscription',reference:'synthetic',amountMinor:1.5,currency:'INR'})).rejects.toThrow('quote');expect(db.$transaction).not.toHaveBeenCalled();});
});
