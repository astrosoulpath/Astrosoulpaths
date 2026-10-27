import { AdminPaymentReconciliationWorker } from './admin-payment-reconciliation.worker';
describe('bounded TEST reconciliation worker',()=>{
 const env={...process.env};
 afterEach(()=>{process.env={...env};});
 function fixture(name='asp_payment_operations_123456abcdef'){
  const db:any={$queryRaw:jest.fn().mockImplementation(async(sql:any)=>sql.join('').includes('current_database()')?[{name,port:16432}]:[{id:'synthetic-payment',attempts:0,lastAttempt:null}])};
  const operations:any={reconcile:jest.fn().mockResolvedValue({success:true,data:{status:'pending'}})};
  return{db,operations,worker:new AdminPaymentReconciliationWorker(db,operations)};
 }
 function enabled(){process.env.RAZORPAY_KEY_ID='rzp_test_synthetic';process.env.PAYMENT_RECONCILIATION_WORKER_ENABLED='true';process.env.PAYMENT_CREATION_SCHEMA_READY='true';process.env.ADMIN_FINANCE_TEST_OPERATIONS_ENABLED='true';process.env.ADMIN_FINANCE_TEST_ACTOR_ID='synthetic-admin';}
 it('default-off performs no query',async()=>{delete process.env.PAYMENT_RECONCILIATION_WORKER_ENABLED;const f=fixture();await f.worker.tick();expect(f.db.$queryRaw).not.toHaveBeenCalled();});
 it('shared database cannot trigger any provider reconciliation',async()=>{enabled();const f=fixture('astro_soul_path');await f.worker.tick();expect(f.operations.reconcile).not.toHaveBeenCalled();});
 it('worker instances use the same durable claim for the same attempt',async()=>{enabled();const f=fixture();const second=new AdminPaymentReconciliationWorker(f.db,f.operations);await f.worker.tick();await second.tick();expect(f.operations.reconcile.mock.calls[0][2].requestKey).toBe(f.operations.reconcile.mock.calls[1][2].requestKey);});
 it('bounded attempts and exponential backoff preserve pending status',async()=>{enabled();const f=fixture();f.db.$queryRaw.mockResolvedValueOnce([{name:'asp_payment_operations_123456abcdef',port:16432}]).mockResolvedValueOnce([{id:'synthetic',attempts:3,lastAttempt:new Date()}]);await f.worker.tick();expect(f.operations.reconcile).not.toHaveBeenCalled();expect(f.db.$queryRaw.mock.calls[1][0].join('')).toContain('HAVING COUNT(a.id)<5');});
});
