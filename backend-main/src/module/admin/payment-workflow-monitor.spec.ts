import { paymentWorkflowMonitor } from './payment-workflow-monitor';
describe('Admin payment workflow read model',()=>{
 const previous=process.env.PAYMENT_INTEGRITY_SCHEMA_READY;
 afterEach(()=>{if(previous===undefined)delete process.env.PAYMENT_INTEGRITY_SCHEMA_READY;else process.env.PAYMENT_INTEGRITY_SCHEMA_READY=previous;});
 it('reports unknown schema without querying missing tables',async()=>{
  delete process.env.PAYMENT_INTEGRITY_SCHEMA_READY;const db:any={$transaction:jest.fn()};
  expect(await paymentWorkflowMonitor(db)).toMatchObject({schemaReady:false,workflowEnabled:false});expect(db.$transaction).not.toHaveBeenCalled();
 });
 it('uses a read-only snapshot and exposes grouped counts only',async()=>{
  process.env.PAYMENT_INTEGRITY_SCHEMA_READY='true';
  const tx={$executeRaw:jest.fn(),$queryRaw:jest.fn().mockResolvedValueOnce([{state:'UNKNOWN',currency:'INR',count:1,amountMinor:'100'}]).mockResolvedValueOnce([{status:'REFUND_REQUIRED',currency:'INR',count:2}])};
  const db:any={$transaction:jest.fn(callback=>callback(tx))};const result=await paymentWorkflowMonitor(db);
  expect(tx.$executeRaw.mock.calls[0][0].join('')).toContain('READ ONLY');
  expect(result).toMatchObject({schemaReady:true,refunds:[{currency:'INR',count:1}]});
  expect(JSON.stringify(result)).not.toMatch(/providerPaymentId|token|secret/);
 });
});
