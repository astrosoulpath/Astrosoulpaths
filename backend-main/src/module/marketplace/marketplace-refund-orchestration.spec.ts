import { MarketplaceCaseService } from './marketplace-case.service';
import { MarketplaceRefundWorkflow } from './marketplace-refund-workflow';
import { MarketplaceRefundJournal } from './marketplace-refund-journal';
import * as razorpayConfig from '../../config/razorpay.config';
const allocation={sellerOrderId:'seller',currency:'INR',productMinor:100,discountMinor:0,shippingMinor:0,taxMinor:0,feeMinor:0};
const approved={orderId:'order',amountMinor:100,currency:'INR',razorpayPaymentId:'pay_synthetic'};
describe('Admin refund preparation and crash reconciliation',()=>{
 const keys=['MARKETPLACE_CASES_ENABLED','MARKETPLACE_REFUND_WORKFLOW_ENABLED','MARKETPLACE_REFUND_POLICY_APPROVED','MARKETPLACE_REFUND_POLICY_REVISION','MARKETPLACE_REFUND_RECONCILE_ENABLED','RAZORPAY_KEY_ID'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 let tx:any,db:any,service:MarketplaceCaseService;
 beforeEach(()=>{
  Object.assign(process.env,{MARKETPLACE_CASES_ENABLED:'true',MARKETPLACE_REFUND_WORKFLOW_ENABLED:'true',MARKETPLACE_REFUND_POLICY_APPROVED:'true',MARKETPLACE_REFUND_POLICY_REVISION:'synthetic-policy'});
  tx={$queryRaw:jest.fn().mockResolvedValueOnce([approved]).mockResolvedValueOnce([]).mockResolvedValueOnce([{sellerOrderId:'seller',productMinor:100n,shippingMinor:0n,taxMinor:0n}]),$executeRaw:jest.fn().mockResolvedValue(1),marketplaceCaseEvent:{create:jest.fn()}};
  db={userAuthIdentity:{findUnique:jest.fn().mockResolvedValue(null)},user:{findUnique:jest.fn().mockResolvedValue({id:'admin',isActive:true,isBlocked:false,role:{name:'ADMIN'}})},$transaction:jest.fn(async fn=>fn(tx))};
  service=new MarketplaceCaseService(db);
 });
 afterEach(()=>{jest.restoreAllMocks();for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}});
 it.each(['CUSTOMER','ASTROLOGER'])('rejects %s before financial queries',async role=>{db.user.findUnique.mockResolvedValue({isActive:true,role:{name:role}});await expect(service.prepareRefund('subject','case',{allocations:[allocation]})).rejects.toThrow('denied');expect(db.$transaction).not.toHaveBeenCalled();});
 it('rejects disabled admin',async()=>{db.user.findUnique.mockResolvedValue({isActive:false,role:{name:'ADMIN'}});await expect(service.prepareRefund('subject','case',{allocations:[allocation]})).rejects.toThrow('denied');});
 it('requires separately approved policy',async()=>{delete process.env.MARKETPLACE_REFUND_POLICY_APPROVED;await expect(service.prepareRefund('subject','case',{allocations:[allocation]})).rejects.toThrow('policy');expect(db.$transaction).not.toHaveBeenCalled();});
 it('prepares one immutable intent and durable actor audit in Serializable transaction',async()=>{const result=await service.prepareRefund('subject','case',{allocations:[allocation]});expect(result.alreadyPrepared).toBe(false);expect(tx.$executeRaw).toHaveBeenCalledTimes(1);expect(tx.marketplaceCaseEvent.create).toHaveBeenCalledWith({data:{caseId:'case',actorUserId:'admin',action:'REFUND_INTENT_PREPARED'}});expect(db.$transaction.mock.calls[0][1]).toEqual({isolationLevel:'Serializable'});});
 it('rejects an unowned or unapproved case',async()=>{tx.$queryRaw.mockReset().mockResolvedValue([]);await expect(service.prepareRefund('subject','case',{allocations:[allocation]})).rejects.toThrow('Approved');expect(tx.$executeRaw).not.toHaveBeenCalled();});
 it('rejects already reserved component money, including UNKNOWN attempts',async()=>{tx.$queryRaw.mockReset().mockResolvedValueOnce([approved]).mockResolvedValueOnce([{id:'other',caseId:'other',amountMinor:60n,currency:'INR',componentSnapshot:{version:1,allocations:[{...allocation,productMinor:60}]}}]).mockResolvedValueOnce([{sellerOrderId:'seller',productMinor:100n,shippingMinor:0n,taxMinor:0n}]);await expect(service.prepareRefund('subject','case',{allocations:[allocation]})).rejects.toThrow('unreserved');expect(tx.$executeRaw).not.toHaveBeenCalled();});
 it('repeated same case returns original intent without duplicate insert',async()=>{tx.$queryRaw.mockReset().mockResolvedValueOnce([approved]).mockResolvedValueOnce([{id:'same',caseId:'case',amountMinor:100n,currency:'INR',policyRevision:'synthetic-policy',componentSnapshot:{version:1,allocations:[allocation]}}]);expect(await service.prepareRefund('subject','case',{allocations:[allocation]})).toEqual({id:'same',alreadyPrepared:true});expect(tx.$executeRaw).not.toHaveBeenCalled();});
 it('cannot use live merchant credentials for reconciliation',async()=>{process.env.MARKETPLACE_REFUND_RECONCILE_ENABLED='true';process.env.RAZORPAY_KEY_ID='rzp_live_synthetic';await expect(service.reconcileRefund('subject','attempt',{refundId:'rfnd_synthetic',fence:'synthetic'})).rejects.toThrow('not activated');});
 it('sanitizes uncertain provider lookup failure without retry or refund dispatch',async()=>{
  Object.assign(process.env,{MARKETPLACE_REFUND_RECONCILE_ENABLED:'true',RAZORPAY_KEY_ID:'rzp_test_synthetic'});
  db.$queryRaw=jest.fn().mockResolvedValue([{caseId:'case'}]);db.marketplaceCaseEvent={create:jest.fn()};
  const fetch=jest.fn().mockRejectedValue(Error('synthetic-private-provider-detail'));
  jest.spyOn(razorpayConfig,'getRazorpayInstance').mockReturnValue({refunds:{fetch}} as any);
  jest.spyOn(MarketplaceRefundWorkflow.prototype,'reconcileAndPost').mockImplementation(async(_id,_fence,_refundId,verify)=>verify('pay_synthetic','rfnd_synthetic') as any);
  await expect(service.reconcileRefund('subject','attempt',{refundId:'rfnd_synthetic',fence:'synthetic'})).rejects.toThrow('Refund evidence unavailable; reconcile without resubmission');
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it.each([{providerConfirmed:true,financialJournalPosted:false},{alreadyConfirmed:true}])('confirmation and crash replay both converge on journal posting %#',async result=>{
  jest.spyOn(MarketplaceRefundWorkflow.prototype,'reconcile').mockResolvedValue(result as any);
  const post=jest.spyOn(MarketplaceRefundJournal.prototype,'postConfirmed').mockResolvedValue({financialJournalPosted:true,suborders:1});
  expect((await new MarketplaceRefundWorkflow(db).reconcileAndPost('attempt','fence','rfnd_synthetic',jest.fn())).financialJournalPosted).toBe(true);expect(post).toHaveBeenCalledTimes(1);
 });
 it.each([{pending:true},{providerConfirmed:false,financialJournalPosted:false}])('pending or failed provider proof cannot post %#',async result=>{
  jest.spyOn(MarketplaceRefundWorkflow.prototype,'reconcile').mockResolvedValue(result as any);
  const post=jest.spyOn(MarketplaceRefundJournal.prototype,'postConfirmed');
  await new MarketplaceRefundWorkflow(db).reconcileAndPost('attempt','fence','rfnd_synthetic',jest.fn());expect(post).not.toHaveBeenCalled();
 });
 it('Admin monitoring separates provider confirmation from incomplete financial posting',async()=>{
  db.$queryRaw=jest.fn().mockResolvedValueOnce([{id:'attempt',state:'PROVIDER_CONFIRMED',amountMinor:100n,currency:'INR',providerRefundId:'rfnd_synthetic',leaseToken:'fence',expectedEntries:2,postedEntries:1}]).mockResolvedValueOnce([]);
  const result=await service.refundStatus('subject','attempt');
  expect(result.data).toMatchObject({amountMinor:'100',providerConfirmed:true,financialJournalPosted:false,canSubmit:false,bankSettlement:'UNVERIFIED',reconciliation:{refundId:'rfnd_synthetic',fence:'fence'}});
  expect(result.data).not.toHaveProperty('leaseToken');
 });
 it('monitoring reports journal complete only when every expected immutable entry exists',async()=>{
  db.$queryRaw=jest.fn().mockResolvedValueOnce([{id:'attempt',state:'PROVIDER_CONFIRMED',amountMinor:100n,expectedEntries:1,postedEntries:1}]).mockResolvedValueOnce([]);
  expect((await service.refundStatus('subject','attempt')).data.financialJournalPosted).toBe(true);
 });
 it('Customer cannot read Admin refund monitoring or invoke provider submission',async()=>{
  db.user.findUnique.mockResolvedValue({id:'customer',isActive:true,isBlocked:false,role:{name:'CUSTOMER'}});
  db.$queryRaw=jest.fn();await expect(service.refundStatus('subject','attempt')).rejects.toThrow('access denied');expect(db.$queryRaw).not.toHaveBeenCalled();
 });
});
