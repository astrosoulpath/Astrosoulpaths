import { checkoutSnapshot } from './marketplace-checkout-snapshot';
const quote={policyRevision:'synthetic',providerQuoteId:'quote-synthetic',taxEvidenceRef:'classification-synthetic',dispatchPostalCode:'110001',package:{weightGrams:100,lengthMm:10,widthMm:10,heightMm:10},destinationCountry:'IN',dispatchCountry:'IN',destinationPostalCode:'110002',methodId:'synthetic',currency:'INR',shippingMinor:200,productTaxMinor:180,shippingTaxMinor:20,taxMode:'EXCLUSIVE' as 'EXCLUSIVE'|'INCLUSIVE',taxCategory:'synthetic',expiresAt:2000};
const input={orderId:'order',customerUserId:'customer',sellerOrderId:'seller',items:[{productId:'p1',quantity:2,unitPriceMinor:500},{productId:'p2',quantity:1,unitPriceMinor:100}],quote};
describe('Server authoritative shipping/tax snapshot preparation',()=>{
  it('snapshots multiple items with separate tax/shipping liabilities',()=>{
    const result=JSON.parse(checkoutSnapshot(input,1000).canonical);
    expect(result.amounts).toEqual({currency:'INR',productMinor:1100,discountMinor:0,shippingMinor:200,taxMinor:200,feeMinor:0});
    expect(result.totalMinor).toBe(1500);
  });
  it('does not charge inclusive tax twice or commission tax',()=>{
    const result=JSON.parse(checkoutSnapshot({...input,quote:{...quote,taxMode:'INCLUSIVE'}},1000).canonical);
    expect(result.amounts.productMinor).toBe(920);expect(result.amounts.shippingMinor).toBe(180);expect(result.totalMinor).toBe(1300);
  });
  it('detaches evidence and has stable item ordering',()=>{
    const first=checkoutSnapshot(input,1000);
    expect(checkoutSnapshot({...input,items:[...input.items].reverse()},1000)).toEqual(first);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each([{quantity:0},{quantity:0.5},{unitPriceMinor:-1},{unitPriceMinor:Number.MAX_SAFE_INTEGER}])('rejects unsafe item values %#',patch=>expect(()=>checkoutSnapshot({...input,items:[{...input.items[0],...patch}]},1000)).toThrow());
  it('rejects duplicate products',()=>expect(()=>checkoutSnapshot({...input,items:[input.items[0],input.items[0]]},1000)).toThrow());
  it('rejects expired quotes',()=>expect(()=>checkoutSnapshot(input,2000)).toThrow());
  it('rejects tax greater than inclusive price',()=>expect(()=>checkoutSnapshot({...input,quote:{...quote,taxMode:'INCLUSIVE',productTaxMinor:9999}},1000)).toThrow());
});
