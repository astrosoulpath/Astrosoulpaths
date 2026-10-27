import { createHmac } from 'crypto';
import { MarketplaceRazorpayTestAdapter } from './marketplace-razorpay-test.adapter';
import { validateMarketplaceQuote } from './marketplace-quote';
import { MarketplaceJournalService } from './marketplace-journal.service';

const config={keyId:'rzp_test_synthetic',secret:'synthetic-only',webhookSecret:'synthetic-hook',approved:true};
const receipt={id:'rfnd_synthetic',payment_id:'pay_synthetic',amount:100,currency:'INR',status:'pending'};
const money={currency:'INR',productMinor:10000,discountMinor:0,shippingMinor:0,taxMinor:0,feeMinor:0};
describe('marketplace Stage 2 provider and journal boundaries',()=>{
  it.each(['rzp_live_synthetic','','invalid'])('rejects non-test credentials without network %s',async keyId=>{
    const transport=jest.fn();await expect(new MarketplaceRazorpayTestAdapter({...config,keyId},transport).refund({paymentId:'pay_synthetic',amount:100,idempotencyKey:'synthetic-key'})).rejects.toThrow();expect(transport).not.toHaveBeenCalled();
  });
  it('test approval is mandatory',async()=>{await expect(new MarketplaceRazorpayTestAdapter({...config,approved:false},jest.fn()).refund({paymentId:'pay_synthetic',amount:100,idempotencyKey:'synthetic-key'})).rejects.toThrow();});
  it('sends explicit amount and stable idempotency, never treats pending as processed',async()=>{
    const transport=jest.fn().mockResolvedValue({ok:true,json:async()=>({...receipt,notes:{private:'not returned'}})});
    const result=await new MarketplaceRazorpayTestAdapter(config,transport).refund({paymentId:'pay_synthetic',amount:100,idempotencyKey:'synthetic-key'});
    expect(result).toEqual(receipt);expect(transport.mock.calls[0][1].headers['X-Refund-Idempotency']).toBe('synthetic-key');expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({amount:100,speed:'normal'});
  });
  it('does not retry an uncertain provider operation or expose the provider exception',async()=>{
    const transport=jest.fn().mockRejectedValue(Error('secret-token'));await expect(new MarketplaceRazorpayTestAdapter(config,transport).refund({paymentId:'pay_synthetic',amount:100,idempotencyKey:'synthetic-key'})).rejects.toThrow('requires reconciliation');expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([{currency:'USD'},{amount:101},{payment_id:'pay_foreign'},{status:'unknown'}])('rejects refund mismatch %j',async mismatch=>{
    await expect(new MarketplaceRazorpayTestAdapter(config,jest.fn().mockResolvedValue({ok:true,json:async()=>({...receipt,...mismatch})})).refund({paymentId:'pay_synthetic',amount:100,idempotencyKey:'synthetic-key'})).rejects.toThrow('mismatch');
  });
  it.each(['pending','processed','failed'])('preserves actual provider refund status %s',async status=>{
    const adapter=new MarketplaceRazorpayTestAdapter(config,jest.fn().mockResolvedValue({ok:true,json:async()=>({...receipt,status})}));expect((await adapter.fetchRefund('rfnd_synthetic','pay_synthetic',100)).status).toBe(status);
  });
  it('requires original signed bytes',()=>{
    const adapter=new MarketplaceRazorpayTestAdapter(config,jest.fn()),raw=Buffer.from('{ "event":"refund.processed" }');const signature=createHmac('sha256',config.webhookSecret).update(raw).digest('hex');
    expect(adapter.verifyRawWebhook(raw,signature).event).toBe('refund.processed');expect(()=>adapter.verifyRawWebhook(Buffer.from(JSON.stringify(JSON.parse(raw.toString()))),signature)).toThrow();
  });
  it('requires fetched captured payment plus valid signature',async()=>{
    const input={paymentId:'pay_synthetic',orderId:'order_synthetic',amount:100,currency:'INR',signature:createHmac('sha256',config.secret).update('order_synthetic|pay_synthetic').digest('hex')};
    const transport=jest.fn().mockResolvedValue({ok:true,json:async()=>({id:input.paymentId,order_id:input.orderId,amount:100,currency:'INR',status:'authorized'})});
    await expect(new MarketplaceRazorpayTestAdapter(config,transport).verifyCaptured(input)).rejects.toThrow('mismatch');
  });
  it('accepts exact captured receipt and rejects wrong signature before network',async()=>{
    const input={paymentId:'pay_synthetic',orderId:'order_synthetic',amount:100,currency:'INR',signature:createHmac('sha256',config.secret).update('order_synthetic|pay_synthetic').digest('hex')};
    const transport=jest.fn().mockResolvedValue({ok:true,json:async()=>({id:input.paymentId,order_id:input.orderId,amount:100,currency:'INR',status:'captured'})});
    const adapter=new MarketplaceRazorpayTestAdapter(config,transport);
    expect(await adapter.verifyCaptured(input)).toEqual({verified:true});
    await expect(adapter.verifyCaptured({...input,signature:'0'.repeat(64)})).rejects.toThrow('signature');expect(transport).toHaveBeenCalledTimes(1);
  });
  it('fails closed when shipping/tax policy is absent',()=>expect(()=>validateMarketplaceQuote(undefined)).toThrow());
  const quote={policyRevision:'synthetic-v1',providerQuoteId:'synthetic-quote',taxEvidenceRef:'synthetic-classification',dispatchPostalCode:'110001',package:{weightGrams:100,lengthMm:100,widthMm:100,heightMm:100},destinationCountry:'IN',dispatchCountry:'IN',destinationPostalCode:'110001',methodId:'synthetic-approved',currency:'INR',shippingMinor:100,productTaxMinor:0,shippingTaxMinor:0,taxMode:'EXCLUSIVE' as const,taxCategory:'synthetic-approved-zero',expiresAt:2000};
  it('preserves explicitly supplied quote without inventing delivery estimate',()=>expect(validateMarketplaceQuote(quote,1000)).toEqual(quote));
  it.each([{destinationCountry:'US'},{dispatchCountry:'US'},{currency:'USD'},{expiresAt:999},{methodId:''},{policyRevision:''},{taxCategory:''},{destinationPostalCode:'bad'},{shippingMinor:0.1},{productTaxMinor:-1}])('rejects unsupported/invalid quote %j',bad=>expect(()=>validateMarketplaceQuote({...quote,...bad},1000)).toThrow());
  it.each([{providerQuoteId:''},{taxEvidenceRef:''},{dispatchPostalCode:'bad'},{package:{weightGrams:0,lengthMm:100,widthMm:100,heightMm:100}}])('requires provider and classification evidence %j',bad=>expect(()=>validateMarketplaceQuote({...quote,...bad},1000)).toThrow());
  it('locks suborder before any journal read and inserts atomically',async()=>{
    const query=jest.fn().mockResolvedValueOnce([{id:'so'}]).mockResolvedValueOnce([]),execute=jest.fn();const tx={$queryRaw:query,$executeRaw:execute};const db={$transaction:jest.fn(async (fn, _options)=>fn(tx))};
    await new MarketplaceJournalService(db as any).append('so','capture:synthetic','CAPTURE',money);
    expect(query.mock.calls[0][0].join('?')).toContain('FOR UPDATE');expect(execute).toHaveBeenCalledTimes(1);expect(db.$transaction.mock.calls[0][1]).toEqual({isolationLevel:'Serializable'});
  });
  it('lock failure prevents insert and no retry',async()=>{
    const execute=jest.fn(),db={$transaction:jest.fn(async fn=>fn({$queryRaw:jest.fn().mockRejectedValue(Error('locked')),$executeRaw:execute}))};
    await expect(new MarketplaceJournalService(db as any).append('so','capture:synthetic','CAPTURE',money)).rejects.toThrow();expect(execute).not.toHaveBeenCalled();expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('duplicate old refund remains idempotent after later refunds changed rounding',async()=>{
    const entries=[{eventKey:'refund:synthetic',kind:'REFUND',currency:'INR',productMinor:1n,shippingMinor:0n,taxMinor:0n,feeMinor:0n,sellerMinor:1n,platformMinor:0n}];
    const execute=jest.fn(),query=jest.fn().mockResolvedValueOnce([{id:'so'}]).mockResolvedValueOnce(entries),db={$transaction:async fn=>fn({$queryRaw:query,$executeRaw:execute})};
    expect(await new MarketplaceJournalService(db as any).append('so','refund:synthetic','REFUND',{...money,productMinor:1})).toEqual({alreadyRecorded:true});expect(execute).not.toHaveBeenCalled();
  });
  function journal() {
    const entries:any[]=[];
    const tx={$queryRaw:jest.fn(async (q:any)=>q.join('?').includes('FOR UPDATE')?[{id:'so'}]:entries),$executeRaw:jest.fn(async (_q:any,...v:any[])=>{entries.push({eventKey:v[2],kind:v[3],currency:v[4],productMinor:v[5],discountMinor:v[6],shippingMinor:v[7],taxMinor:v[8],feeMinor:v[9],sellerMinor:v[10],platformMinor:v[11]});return 1;})};
    return {entries,tx,service:new MarketplaceJournalService({$transaction:async fn=>fn(tx)} as any)};
  }
  it('capture and duplicate payment events post once',async()=>{
    const j=journal();await j.service.append('so','capture:synthetic','CAPTURE',money);await j.service.append('so','capture:synthetic','CAPTURE',money);expect(j.entries).toHaveLength(1);
    await expect(j.service.append('so','capture:another','CAPTURE',money)).rejects.toThrow('already');
  });
  it('retains discount snapshot and original product gross without reducing shipping or tax',async()=>{
    const j=journal();await j.service.append('so','capture:discount','CAPTURE',{...money,productMinor:10001,discountMinor:1,shippingMinor:200,taxMinor:1800});
    const e=j.entries[0];expect(e.discountMinor).toBe(1n);expect(e.productMinor+e.discountMinor).toBe(10001n);expect(e.sellerMinor).toBe(7000n);expect(e.shippingMinor).toBe(200n);expect(e.taxMinor).toBe(1800n);
  });
  it('partial, duplicate, full refund and negative refundable balance protection',async()=>{
    const j=journal();await j.service.append('so','capture:synthetic','CAPTURE',money);
    const part={...money,productMinor:5000};await j.service.append('so','refund:synthetic1','REFUND',part);await j.service.append('so','refund:synthetic1','REFUND',part);await j.service.append('so','refund:synthetic2','REFUND',part);
    expect(j.entries).toHaveLength(3);expect(j.entries.filter(e=>e.kind==='REFUND').reduce((n,e)=>n+e.sellerMinor,0n)).toBe(7000n);
    await expect(j.service.append('so','refund:excess','REFUND',{...money,productMinor:1})).rejects.toThrow('balance');
  });
  it('settlement retry does not post twice and cannot exceed remaining liability',async()=>{
    const j=journal();await j.service.append('so','capture:synthetic','CAPTURE',money);const paid={...money,productMinor:7000};
    await j.service.append('so','settlement:synthetic','SETTLEMENT',paid);await j.service.append('so','settlement:synthetic','SETTLEMENT',paid);expect(j.entries).toHaveLength(2);
    await expect(j.service.append('so','settlement:excess','SETTLEMENT',{...paid,productMinor:1})).rejects.toThrow('liability');
  });
  it('refund after settlement creates compensation without mutating previous entries',async()=>{
    const j=journal();await j.service.append('so','capture:synthetic','CAPTURE',money);await j.service.append('so','settlement:synthetic','SETTLEMENT',{...money,productMinor:7000});const old=j.entries.slice();
    await j.service.append('so','refund:synthetic','REFUND',money);expect(j.entries.slice(0,2)).toEqual(old);expect(j.entries[2].sellerMinor).toBe(7000n);
  });
  it('out-of-order refund cannot create financial entries before capture',async()=>{
    const j=journal();await expect(j.service.append('so','refund:synthetic','REFUND',money)).rejects.toThrow('capture');expect(j.entries).toHaveLength(0);
  });
  it('reused event key with conflicting amount is rejected',async()=>{
    const j=journal();await j.service.append('so','capture:synthetic','CAPTURE',money);await j.service.append('so','refund:synthetic','REFUND',{...money,productMinor:100});
    await expect(j.service.append('so','refund:synthetic','REFUND',{...money,productMinor:101})).rejects.toThrow('mismatch');expect(j.entries).toHaveLength(2);
  });
});
