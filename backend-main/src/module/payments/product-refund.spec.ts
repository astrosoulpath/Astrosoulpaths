jest.mock('../../config/razorpay.config',()=>({getRazorpayInstance:jest.fn()}));
import { getRazorpayInstance } from '../../config/razorpay.config';
import { ProductRefundService } from './product-refund.service';
import { minorUnits, PRODUCT_REFUND_POLICY, productRefundSnapshot } from './product-refund-policy';

describe('default-off wallet/subscription full refund handlers (synthetic stores/providers)',()=>{
  const env={...process.env},reason='Approved synthetic full-principal refund';
  beforeEach(()=>Object.assign(process.env,{RAZORPAY_KEY_ID:'rzp_test_synthetic',PAYMENT_CREATION_SCHEMA_READY:'true',
    PRODUCT_REFUND_SCHEMA_READY:'true',PRODUCT_REFUND_EXECUTION_ENABLED:'true',PRODUCT_REFUND_POLICY_APPROVED:'true',RAZORPAY_REFUNDS_ENABLED:'true',RAZORPAY_REFUND_POLICY_REVISION:PRODUCT_REFUND_POLICY}));
  afterEach(()=>{process.env={...env};jest.clearAllMocks();});
  function fixture(kind='WALLET') {
    const events=new Map<string,any>();
    const order:any={id:'synthetic-order',userId:'synthetic-customer',walletId:'synthetic-wallet',status:'SUCCESS',type:kind==='WALLET'?'WALLET_RECHARGE':'SUBSCRIPTION',
      amount:kind==='WALLET'?'100':'3500',currency:'INR',razorpayOrderId:'order_synthetic',razorpayPaymentId:'pay_synthetic',metadata:{providerMode:'TEST',subscriptionId:'synthetic-sub'}};
    const w:any={id:order.walletId,userId:order.userId,currency:'INR',balance:100,paidBalance:100,freeBalance:0,lockedBalance:0};
    const sub:any={id:'synthetic-sub',userId:order.userId,subscriptionStatus:'ACTIVE',amount:'3500',currency:'INR',razorpayOrderId:order.razorpayOrderId,
      razorpayPaymentId:order.razorpayPaymentId,updatedAt:new Date('2026-10-27T00:00:00Z'),subscriptionPlan:{name:'ASTROLOGER_KUNDLI_YEARLY',durationDays:365}};
    const ledger:any[]=[{userId:order.userId,walletId:w.id,type:'RECHARGE',referenceId:order.id,amount:100}];
    const actor={isActive:true,isBlocked:false,role:{name:'ADMIN'}};
    function update(target:any,data:any){for(const [key,value] of Object.entries(data))target[key]=value&&typeof value==='object'&&('increment'in value||'decrement'in value)?Number(target[key])+Number((value as any).increment||0)-Number((value as any).decrement||0):value;return target;}
    const db:any={user:{findUnique:jest.fn(async({where}:any)=>where.id==='admin'?actor:{role:{name:'ASTROLOGER'}})},
      paymentOrder:{findUnique:jest.fn(async()=>order),update:jest.fn(async({data}:any)=>update(order,data))},
      wallet:{findUnique:jest.fn(async()=>w),update:jest.fn(async({data}:any)=>update(w,data))},
      walletLedger:{findMany:jest.fn(async()=>ledger),create:jest.fn(async({data}:any)=>{ledger.push(data);return data;})},
      subscription:{findUnique:jest.fn(async()=>sub),update:jest.fn(async({data}:any)=>update(sub,data))},
      adminFinanceAction:{findUnique:jest.fn(async({where}:any)=>events.get(where.requestKey)),create:jest.fn(async({data}:any)=>{
        if(events.has(data.requestKey))throw Error('Unique request conflict');events.set(data.requestKey,data);return data;
      }),update:jest.fn(async({where,data}:any)=>{const row=[...events.values()].find(x=>x.id===where.id);return update(row,data);})},
      $queryRaw:jest.fn(async()=>[])};
    // Serialize synthetic transactions and rollback all store effects on failure.
    let queue=Promise.resolve();db.$transaction=jest.fn((body:any)=>{
      const run=queue.then(async()=>{const saved=JSON.parse(JSON.stringify({order,w,sub,ledger,events:[...events]}));try{return await body(db);}catch(e){
        Object.assign(order,saved.order);Object.assign(w,saved.w);Object.assign(sub,saved.sub);ledger.splice(0,ledger.length,...saved.ledger);events.clear();for(const [k,v] of saved.events)events.set(k,v);throw e;}});
      queue=run.catch(()=>undefined);return run;
    });
    const provider:any={orders:{fetch:jest.fn(async()=>({id:order.razorpayOrderId,amount:Number(order.amount)*100,currency:order.currency,status:'paid'}))},
      payments:{fetch:jest.fn(async()=>({id:order.razorpayPaymentId,order_id:order.razorpayOrderId,amount:Number(order.amount)*100,currency:order.currency,status:'captured',captured:true,amount_refunded:0})),
        fetchMultipleRefund:jest.fn(async()=>({items:[]})),refund:jest.fn(async(_id:any,body:any)=>({id:'rfnd_synthetic',payment_id:order.razorpayPaymentId,amount:body.amount,currency:order.currency,receipt:body.receipt,status:'processed'}))},
      refunds:{fetch:jest.fn(async()=>{const body=provider.payments.refund.mock.calls[0][1];return {id:'rfnd_synthetic',payment_id:order.razorpayPaymentId,amount:body.amount,currency:order.currency,receipt:body.receipt,status:'processed'};})}};
    (getRazorpayInstance as jest.Mock).mockReturnValue(provider);
    return {db,events,order,w,sub,ledger,actor,provider,service:new ProductRefundService(db)};
  }
  it.each(['0','-1','1.001','NaN','1e2','9007199254740992'])('rejects unsafe amount %s',value=>expect(()=>minorUnits(value)).toThrow());
  it('parses decimal principal without floating point rounding',()=>expect(minorUnits('19.99')).toBe(1999));
  it.each(['PRODUCT_REFUND_SCHEMA_READY','PRODUCT_REFUND_EXECUTION_ENABLED','PRODUCT_REFUND_POLICY_APPROVED','RAZORPAY_REFUNDS_ENABLED','PAYMENT_CREATION_SCHEMA_READY'])('fails closed without %s',async gate=>{
    const f=fixture();delete process.env[gate];await expect(f.service.prepare('admin',f.order.id,reason)).rejects.toThrow('gates');expect(f.db.$transaction).not.toHaveBeenCalled();
  });
  it.each(['CUSTOMER','ASTROLOGER'])('rejects %s authority before financial writes',async role=>{
    const f=fixture();f.actor.role.name=role;await expect(f.service.prepare('admin',f.order.id,reason)).rejects.toThrow('Admin');expect(f.events.size).toBe(0);expect(f.w.lockedBalance).toBe(0);
  });
  it('rejects cross-environment and historical UNKNOWN payments',async()=>{
    const f=fixture();f.order.metadata.providerMode='UNKNOWN';await expect(f.service.prepare('admin',f.order.id,reason)).rejects.toThrow('environment');expect(f.w.lockedBalance).toBe(0);
  });
  it('holds principal once under concurrent prepares without a debit',async()=>{
    const f=fixture();await Promise.all([f.service.prepare('admin',f.order.id,reason),f.service.prepare('admin',f.order.id,reason)]);
    expect(f.w).toMatchObject({balance:100,paidBalance:100,lockedBalance:100});expect(f.events.size).toBe(1);expect(f.provider.payments.refund).not.toHaveBeenCalled();
  });
  it.each([{freeBalance:10},{balance:99},{lockedBalance:1},{userId:'foreign'},{currency:'USD'}])('rejects spent/bonus/foreign wallet %j',async patch=>{
    const f=fixture();Object.assign(f.w,patch);await expect(f.service.prepare('admin',f.order.id,reason)).rejects.toThrow('unspent');expect(f.events.size).toBe(0);
  });
  it('audit failure rolls back the reservation',async()=>{
    const f=fixture();f.db.adminFinanceAction.create.mockRejectedValue(Error('audit unavailable'));await expect(f.service.prepare('admin',f.order.id,reason)).rejects.toThrow('audit');expect(f.w.lockedBalance).toBe(0);
  });
  it('wallet processed proof debits exactly once and journals exactly once',async()=>{
    const f=fixture();await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);
    expect(f.w.balance).toBe(100);expect(f.order.status).toBe('SUCCESS');
    await Promise.all([f.service.reconcile('admin',f.order.id,reason),f.service.reconcile('admin',f.order.id,reason)]);
    expect(f.w).toMatchObject({balance:0,paidBalance:0,lockedBalance:0});expect(f.ledger.filter(x=>x.type==='RECHARGE_REFUND')).toHaveLength(1);expect(f.order.status).toBe('REFUNDED');
    await expect(f.service.submit('admin',f.order.id,reason)).rejects.toThrow('already claimed');expect(f.provider.payments.refund).toHaveBeenCalledTimes(1);
  });
  it('pending proof leaves balance, hold and order unchanged',async()=>{
    const f=fixture();await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);
    const original=f.provider.refunds.fetch.getMockImplementation();f.provider.refunds.fetch.mockImplementation(async()=>({...await original(),status:'pending'}));
    expect(await f.service.reconcile('admin',f.order.id,reason)).toMatchObject({state:'PENDING',financialApplied:false});expect(f.w.lockedBalance).toBe(100);expect(f.order.status).toBe('SUCCESS');
  });
  it('failed proof releases hold without wallet debit',async()=>{
    const f=fixture();await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);
    const original=f.provider.refunds.fetch.getMockImplementation();f.provider.refunds.fetch.mockImplementation(async()=>({...await original(),status:'failed'}));
    await f.service.reconcile('admin',f.order.id,reason);expect(f.w).toMatchObject({balance:100,paidBalance:100,lockedBalance:0});expect(f.ledger).toHaveLength(1);expect(f.order.status).toBe('SUCCESS');
  });
  it('timeout never resubmits or releases a hold',async()=>{
    const f=fixture();await f.service.prepare('admin',f.order.id,reason);f.provider.payments.refund.mockRejectedValue(Error('timeout'));
    await expect(f.service.submit('admin',f.order.id,reason)).rejects.toThrow('uncertain');await expect(f.service.submit('admin',f.order.id,reason)).rejects.toThrow('already claimed');
    expect(f.w.lockedBalance).toBe(100);expect(f.provider.payments.refund).toHaveBeenCalledTimes(1);
  });
  it('professional subscription cancels only after processed proof, gross 100% platform',async()=>{
    const f=fixture('SUBSCRIPTION');await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);expect(f.sub.subscriptionStatus).toBe('ACTIVE');
    expect(await f.service.reconcile('admin',f.order.id,reason)).toMatchObject({state:'PROCESSED',platformGrossReversalMinor:350000,astrologerReversalMinor:0});expect(f.sub.subscriptionStatus).toBe('CANCELLED');
  });
  it('horoscope USD1/30 days uses distinct full gross policy',async()=>{
    const f=fixture('SUBSCRIPTION');Object.assign(f.order,{amount:'1',currency:'USD'});Object.assign(f.sub,{amount:'1',currency:'USD',subscriptionPlan:{name:'DAILY_HOROSCOPE_MONTHLY',durationDays:30}});
    await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);
    expect(await f.service.reconcile('admin',f.order.id,reason)).toMatchObject({platformGrossReversalMinor:100,astrologerReversalMinor:0});
  });
  it('renewal drift after submission does not cancel the new entitlement',async()=>{
    const f=fixture('SUBSCRIPTION');await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);f.sub.updatedAt=new Date('2026-10-28T00:00:00Z');
    await expect(f.service.reconcile('admin',f.order.id,reason)).rejects.toThrow('renewed');expect(f.sub.subscriptionStatus).toBe('ACTIVE');expect(f.order.status).toBe('SUCCESS');
  });
  it('foreign/mismatched provider proof cannot debit or cancel',async()=>{
    const f=fixture();await f.service.prepare('admin',f.order.id,reason);await f.service.submit('admin',f.order.id,reason);
    const original=f.provider.refunds.fetch.getMockImplementation();f.provider.refunds.fetch.mockImplementation(async()=>({...await original(),payment_id:'pay_foreign'}));
    await expect(f.service.reconcile('admin',f.order.id,reason)).rejects.toThrow('mismatch');expect(f.w.balance).toBe(100);expect(f.w.lockedBalance).toBe(100);
  });
  it('rejects unsupported subscription terms',()=>{const f=fixture('SUBSCRIPTION');f.sub.subscriptionPlan.durationDays=30;expect(()=>productRefundSnapshot(f.order,undefined,undefined,f.sub)).toThrow('terms');});
});
