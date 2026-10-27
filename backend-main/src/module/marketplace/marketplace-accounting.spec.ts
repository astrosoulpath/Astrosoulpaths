import { allocation, refundAllocation, settlementLiability, MarketplaceAmounts } from './marketplace-accounting';

const amount: MarketplaceAmounts = { currency:'INR', productMinor:10001, discountMinor:1, shippingMinor:200, taxMinor:1800, feeMinor:30 };
describe('marketplace exact component accounting',()=>{
  it('allocates only discounted products at 70/30, separates tax shipping and fees',()=>{
    expect(allocation(amount)).toEqual({gross:12000n,commissionable:10000n,seller:7000n,platform:3000n,shipping:200n,tax:1800n,fee:30n,discount:1n});
  });
  it.each([-1,0.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects invalid money %s',value=>expect(()=>allocation({...amount,productMinor:value})).toThrow());
  it.each(['USD','inr','EUR'])('rejects cross-currency netting %s',currency=>expect(()=>allocation({...amount,currency})).toThrow());
  it('rejects excess discount',()=>expect(()=>allocation({...amount,discountMinor:10002})).toThrow());
  it('full refund reverses original components exactly',()=>{
    expect(refundAllocation(amount,{product:0,shipping:0,tax:0},{product:10000,shipping:200,tax:1800})).toEqual({gross:12000n,product:10000n,platform:3000n,seller:7000n,shipping:200n,tax:1800n});
  });
  it('multiple partial refunds converge to original rounding, including one-paise refunds',()=>{
    let platform=0n,seller=0n;
    for(let n=0;n<10000;n++){const r=refundAllocation(amount,{product:n,shipping:0,tax:0},{product:1,shipping:0,tax:0});platform+=r.platform;seller+=r.seller;}
    expect(platform).toBe(3000n);expect(seller).toBe(7000n);
  });
  it.each([{product:10001,shipping:0,tax:0},{product:0,shipping:201,tax:0},{product:0,shipping:0,tax:1801}])('caps each refundable component',request=>expect(()=>refundAllocation(amount,{product:0,shipping:0,tax:0},request)).toThrow());
  it('refund before payout reduces liability',()=>expect(settlementLiability(7000n,3500n,0n)).toEqual({payable:3500n,recoverable:0n}));
  it('refund after payout records recovery without a wallet debit',()=>expect(settlementLiability(7000n,3500n,7000n)).toEqual({payable:0n,recoverable:3500n}));
  it('rejects over-settlement',()=>expect(()=>settlementLiability(1n,0n,2n)).toThrow());
});
