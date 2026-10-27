jest.mock('jose',()=>({createRemoteJWKSet:jest.fn(),jwtVerify:jest.fn()}));
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
import { AdminPaymentOperationsController } from './admin-payment-operations.controller';
import { AdminPaymentOperationsService } from './admin-payment-operations.service';
describe('Admin TEST payment operations',()=>{
 const env={...process.env};
 beforeEach(()=>{process.env.PAYMENT_CREATION_SCHEMA_READY='true';process.env.ADMIN_FINANCE_TEST_OPERATIONS_ENABLED='true';process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';});
 afterEach(()=>{process.env={...env};});
 function fixture(mode='TEST') {
  const db:any={paymentOrder:{findUnique:jest.fn().mockResolvedValue({id:'synthetic-order',metadata:{providerMode:mode},status:'PENDING',amount:'100',currency:'INR'})},
    user:{findUnique:jest.fn().mockResolvedValue({id:'synthetic-admin',isActive:true,isBlocked:false,role:{name:'ADMIN'}})},
    $queryRaw:jest.fn().mockImplementation(async(sql:any)=>sql.join('').includes('current_database()')?[{name:'asp_payment_operations_123456abcdef',port:16432}]:[]),$executeRaw:jest.fn().mockResolvedValue(1)};
  const payments:any={reconcileTestPaymentForAdmin:jest.fn().mockResolvedValue({status:'pending'})};
  return {db,payments,service:new AdminPaymentOperationsService(db,payments)};
 }
 const body={reason:'Synthetic test reconciliation',requestKey:'12345678-1234-1234-1234-123456789012'};
 it.each(['LIVE','UNKNOWN'])('does not dispatch %s records',async mode=>{
  const f=fixture(mode);await expect(f.service.reconcile('synthetic-admin','synthetic-order',body)).rejects.toThrow('TEST');
  expect(f.payments.reconcileTestPaymentForAdmin).not.toHaveBeenCalled();
 });
 it('does not return private metadata or callback signatures',async()=>{
  const f=fixture();const result=await f.service.detail('synthetic-order');
  expect(result.data.metadata).toBeUndefined();expect(result.data.settlement.status).toBe('UNVERIFIED');
  expect(f.db.paymentOrder.findUnique.mock.calls[0][0].select).not.toHaveProperty('rawWebhook');
  expect(f.db.paymentOrder.findUnique.mock.calls[0][0].select).not.toHaveProperty('razorpaySignature');
 });
 it('duplicate action key cannot invoke provider reconciliation',async()=>{
  const f=fixture();await expect(f.service.reconcile('synthetic-admin','synthetic-order',body)).rejects.toThrow('already submitted');
  expect(f.payments.reconcileTestPaymentForAdmin).not.toHaveBeenCalled();
 });
 it('audits pending reconciliation without claiming capture or settlement',async()=>{
  const f=fixture();f.db.$queryRaw.mockImplementation(async(sql:any)=>sql.join('').includes('current_database()')?[{name:'asp_payment_operations_123456abcdef',port:16432}]:sql.join('').includes('INSERT INTO')?[{id:'synthetic-action'}]:[]);
  expect(await f.service.reconcile('synthetic-admin','synthetic-order',body)).toEqual({success:true,data:{status:'pending'}});
  expect(f.payments.reconcileTestPaymentForAdmin).toHaveBeenCalledTimes(1);
  expect(f.db.$executeRaw.mock.calls[0][0].join('')).toContain("state='SUCCEEDED'");
 });
 it('rejects missing reasons before any query',async()=>{
  const f=fixture();await expect(f.service.reconcile('synthetic-admin','synthetic-order',{...body,reason:''})).rejects.toThrow('reason');
  expect(f.db.paymentOrder.findUnique).not.toHaveBeenCalled();
 });
 it('rejects a forged request role before invoking business operations',()=>{
  const operations:any={reconcile:jest.fn(),detail:jest.fn()};const controller=new AdminPaymentOperationsController(operations);
  expect(()=>controller.reconcile({user:{sub:'synthetic-admin',role:'ADMIN'}},'synthetic-order',body)).toThrow('Verified Firebase Admin context');
  expect(operations.reconcile).not.toHaveBeenCalled();
 });
});
