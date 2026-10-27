import { MarketplaceRefundWorkflow, VerifiedRefund } from './marketplace-refund-workflow';
describe('Default-off durable refund recovery foundation',()=>{
 const previous=process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED;
 const attempt={id:'synthetic',providerPaymentId:'pay_synthetic',amountMinor:100n,currency:'INR',state:'UNKNOWN',providerRefundId:null,leaseToken:'fence'};
 const proof:VerifiedRefund={id:'rfnd_synthetic',paymentId:'pay_synthetic',amountMinor:100n,currency:'INR',status:'processed'};
 let db:any, workflow:MarketplaceRefundWorkflow;
 beforeEach(()=>{process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED='true';db={$queryRaw:jest.fn().mockResolvedValue([attempt]),$executeRaw:jest.fn().mockResolvedValue(1)};workflow=new MarketplaceRefundWorkflow(db);});
 afterEach(()=>{if(previous===undefined)delete process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED;else process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED=previous;});
 it('does nothing when disabled',async()=>{delete process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED;await expect(workflow.claim('synthetic')).rejects.toThrow('not activated');expect(db.$queryRaw).not.toHaveBeenCalled();});
 it('claims only PREPARED and never automatically retries UNKNOWN',async()=>{db.$queryRaw.mockResolvedValue([]);expect(await workflow.claim('synthetic')).toBeNull();expect(db.$queryRaw.mock.calls[0][0].join('')).toContain("state='PREPARED'");});
 it('crash recovery marks UNKNOWN rather than resubmitting',async()=>{await workflow.expireUnknown();expect(db.$executeRaw.mock.calls[0][0].join('')).toContain("state='UNKNOWN'");});
 it('rejects stale fences before calling provider verifier',async()=>{const verify=jest.fn();await expect(workflow.reconcile('synthetic','foreign','rfnd_synthetic',verify)).rejects.toThrow('fence');expect(verify).not.toHaveBeenCalled();});
 it.each([{currency:'USD'},{amountMinor:101n},{paymentId:'foreign'},{id:'foreign'}])('rejects mismatched evidence case %#',async patch=>{await expect(workflow.reconcile('synthetic','fence','rfnd_synthetic',async()=>({...proof,...patch}))).rejects.toThrow('mismatch');expect(db.$executeRaw).not.toHaveBeenCalled();});
 it('pending proof does not post or resubmit',async()=>{expect(await workflow.reconcile('synthetic','fence','rfnd_synthetic',async()=>({...proof,status:'pending'}))).toEqual({pending:true});expect(db.$executeRaw).not.toHaveBeenCalled();});
 it('provider confirmation is explicitly separate from financial posting',async()=>{expect(await workflow.reconcile('synthetic','fence','rfnd_synthetic',async()=>proof)).toEqual({providerConfirmed:true,financialJournalPosted:false});});
 it('duplicate confirmation never posts twice',async()=>{db.$queryRaw.mockResolvedValue([{...attempt,state:'PROVIDER_CONFIRMED',providerRefundId:proof.id}]);expect(await workflow.reconcile('synthetic','fence',proof.id,async()=>proof)).toEqual({alreadyConfirmed:true});expect(db.$executeRaw).not.toHaveBeenCalled();});
});
