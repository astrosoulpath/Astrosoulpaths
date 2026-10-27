import { MarketplaceService } from './marketplace.service';
import { MarketplaceCaseService } from './marketplace-case.service';
import { Prisma } from '@prisma/client';

function service(db: any) { return new MarketplaceService(db, {} as any) as any; }
describe('marketplace authorization, catalogue and immutable commission', () => {
  it('bounds paginated catalogue, preserves eligibility filters and stable order', async () => {
    const findMany = jest.fn().mockResolvedValue([{id:'a',sellingPrice:10,mrp:10,shippingCharge:0},{id:'b'}]);
    const result = await service({marketplaceProduct:{findMany}}).getPublicProducts('test',undefined,undefined,'IN',{page:1,limit:1});
    expect(result.data).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
    const q = findMany.mock.calls[0][0];
    expect(q.take).toBe(2); expect(q.skip).toBe(0);
    expect(q.where.astrologer.is.user.is).toEqual({isActive:true,isBlocked:false});
    expect(q.orderBy).toContainEqual({id:'asc'});
  });
  it('keeps legacy catalogue array response and rejects oversized search', async () => {
    const s=service({marketplaceProduct:{findMany:jest.fn().mockResolvedValue([])}});
    expect((await s.getPublicProducts()).data).toEqual([]);
    await expect(s.getPublicProducts('x'.repeat(201))).rejects.toThrow();
  });
  it('campaign products also require real images and eligible sellers',async()=>{
    const findMany=jest.fn().mockResolvedValue([]);await service({marketplaceCampaign:{findMany}}).getPublicCampaigns();
    const where=findMany.mock.calls[0][0].include.products.where.product;
    expect(where.images).toEqual({some:{}});expect(where.astrologer.is.user.is.isBlocked).toBe(false);
  });
  it.each([{isActive:false,isBlocked:false},{isActive:true,isBlocked:true}])('rejects unavailable accounts', async flags => {
    const s=service({userAuthIdentity:{findUnique:jest.fn().mockResolvedValue(null)},user:{findUnique:jest.fn().mockResolvedValue({id:'u',...flags})}});
    await expect(s.getSellerProfile('subject')).rejects.toThrow();
  });
  it('rejects conflicting canonical and legacy owners', async () => {
    const s=service({userAuthIdentity:{findUnique:jest.fn().mockResolvedValue({userId:'a'})},user:{findUnique:jest.fn().mockResolvedValue({id:'b'})}});
    await expect(s.getSellerProfile('subject')).rejects.toThrow('Conflicting');
  });
  it('seller product updates cannot cross ownership', async () => {
    const s=service({marketplaceProduct:{findFirst:jest.fn().mockResolvedValue(null),update:jest.fn()}});
    s.requireSellerAstrologer=jest.fn().mockResolvedValue({astrologer:{id:'seller-a'}});
    await expect(s.updateSellerProduct('subject','foreign',{})).rejects.toThrow();
    expect(s.prisma.marketplaceProduct.findFirst.mock.calls[0][0].where).toEqual({id:'foreign',astrologerId:'seller-a'});
    expect(s.prisma.marketplaceProduct.update).not.toHaveBeenCalled();
  });
  it('snapshots product subtotal at 70/30 without reading consultation settings', async () => {
    const tx:any={marketplaceOrder:{findFirst:jest.fn().mockResolvedValue({sellerOrders:[{id:'so',astrologerId:'a',currency:'INR',subtotal:new Prisma.Decimal(100),grandTotal:new Prisma.Decimal(120)}]})},marketplaceSellerEarning:{create:jest.fn()},platformSettings:{findUnique:jest.fn()}};
    await service({}).createMarketplaceEarningsAfterVerifiedPayment(tx,'order');
    const data=tx.marketplaceSellerEarning.create.mock.calls[0][0].data;
    expect(data.grossAmount.toString()).toBe('100'); expect(data.netAmount.toString()).toBe('70'); expect(data.status).toBe('PENDING');
    expect(tx.platformSettings.findUnique).not.toHaveBeenCalled();
  });
  it('does not rewrite an existing historical earning', async () => {
    const tx:any={marketplaceOrder:{findFirst:jest.fn().mockResolvedValue({sellerOrders:[{astrologerId:'a',earning:{id:'old'}}]})},marketplaceSellerEarning:{create:jest.fn()}};
    expect((await service({}).createMarketplaceEarningsAfterVerifiedPayment(tx,'order')).createdCount).toBe(0);
    expect(tx.marketplaceSellerEarning.create).not.toHaveBeenCalled();
  });
  it('unpaid orders cannot create earnings', async () => {
    await expect(service({}).createMarketplaceEarningsAfterVerifiedPayment({marketplaceOrder:{findFirst:jest.fn().mockResolvedValue(null)}} as any,'order')).rejects.toThrow();
  });
  it('payout requests fail closed before transaction', async () => {
    const s=service({$transaction:jest.fn()});s.requireSellerAstrologer=jest.fn().mockResolvedValue({astrologer:{id:'a'}});
    const old=process.env.MARKETPLACE_PAYOUT_REQUESTS_ENABLED;delete process.env.MARKETPLACE_PAYOUT_REQUESTS_ENABLED;
    try { await expect(s.requestSellerMarketplacePayout('s')).rejects.toThrow('not enabled'); expect(s.prisma.$transaction).not.toHaveBeenCalled(); }
    finally {if(old===undefined)delete process.env.MARKETPLACE_PAYOUT_REQUESTS_ENABLED;else process.env.MARKETPLACE_PAYOUT_REQUESTS_ENABLED=old;}
  });
});

describe('marketplace checkout/inventory races (no provider calls)',()=>{
  it.each(['CONFIRMED','PROCESSING','COMPLETED'])('duplicate captured payment after %s never decrements inventory',async status=>{
    const tx:any={marketplaceOrder:{findUnique:jest.fn().mockResolvedValue({id:'o',status,razorpayOrderId:'rp',razorpayPaymentId:'pay',paymentVerifiedAt:new Date()})},marketplaceProduct:{updateMany:jest.fn()}};
    const s=service({$transaction:jest.fn(async f=>f(tx))});
    s.findMarketplaceOrderForRazorpayWebhook=jest.fn().mockResolvedValue({id:'o',currency:'INR',grandTotal:new Prisma.Decimal(100),paymentCurrency:'INR',razorpayAmountSubunits:new Prisma.Decimal(10000)});
    const r=await s.finalizeMarketplaceRazorpayWebhook({razorpayOrderId:'rp',razorpayPaymentId:'pay',amount:10000,currency:'INR',status:'captured'});
    expect(r.alreadyConfirmed).toBe(true);expect(tx.marketplaceProduct.updateMany).not.toHaveBeenCalled();
  });
  it('stock finalization checks current seller and category eligibility',async()=>{
    const tx:any={marketplaceOrder:{findUnique:jest.fn().mockResolvedValue({id:'o',status:'PENDING_PAYMENT',razorpayOrderId:'rp',sellerOrders:[{items:[{productId:'p',quantity:1}]}]})},marketplaceProduct:{updateMany:jest.fn().mockResolvedValue({count:0})}};
    const s=service({$transaction:jest.fn(async f=>f(tx))});s.findMarketplaceOrderForRazorpayWebhook=jest.fn().mockResolvedValue({id:'o',currency:'INR',grandTotal:new Prisma.Decimal(100),paymentCurrency:'INR',razorpayAmountSubunits:new Prisma.Decimal(10000)});
    await expect(s.finalizeMarketplaceRazorpayWebhook({razorpayOrderId:'rp',razorpayPaymentId:'pay',amount:10000,currency:'INR',status:'captured'})).rejects.toThrow('out of stock');
    const q=tx.marketplaceProduct.updateMany.mock.calls[0][0];expect(q.where.stock.gte).toBe(1);expect(q.where.category.isActive).toBe(true);expect(q.where.astrologer.user.isBlocked).toBe(false);
  });
  it('inventory update uses ownership and expected-stock fencing',async()=>{
    const updateMany=jest.fn().mockResolvedValue({count:0});const s=service({marketplaceProduct:{updateMany}});s.requireSellerAstrologer=jest.fn().mockResolvedValue({astrologer:{id:'a'}});
    await expect(s.updateSellerInventory('s','p',5,10)).rejects.toThrow('Inventory');expect(updateMany.mock.calls[0][0].where).toMatchObject({id:'p',astrologerId:'a',stock:5});
  });
  it('resume cannot bypass product approval',async()=>{
    const updateMany=jest.fn().mockResolvedValue({count:1});const s=service({marketplaceProduct:{updateMany}});s.requireSellerAstrologer=jest.fn().mockResolvedValue({astrologer:{id:'a'}});
    await s.setSellerProductPaused('s','p',false);expect(updateMany.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
  });
  it('cancellation cannot modify paid/provider-pending orders or restore unreserved stock',async()=>{
    const tx:any={marketplaceOrder:{updateMany:jest.fn().mockResolvedValue({count:0})},marketplaceSellerOrder:{updateMany:jest.fn()}};const s=service({$transaction:jest.fn(async f=>f(tx))});s.resolveMarketplaceCustomer=jest.fn().mockResolvedValue({id:'u'});
    await expect(s.cancelCustomerUnpaidOrder('s','o')).rejects.toThrow();expect(tx.marketplaceOrder.updateMany.mock.calls[0][0].where).toMatchObject({customerUserId:'u',status:'PENDING_PAYMENT',razorpayOrderId:null,paymentVerifiedAt:null});expect(tx.marketplaceSellerOrder.updateMany).not.toHaveBeenCalled();
  });
  it('foreign delivery is blocked without tax/shipping providers',async()=>{
    const s=service({marketplaceOrder:{findFirst:jest.fn().mockResolvedValue(null)},marketplaceAddress:{findFirst:jest.fn().mockResolvedValue({country:'France',countryCode:'FR'})},marketplaceCart:{findUnique:jest.fn()}});s.resolveMarketplaceCustomer=jest.fn().mockResolvedValue({id:'u'});
    await expect(s.prepareCustomerOrder('s',{addressId:'address',idempotencyKey:'synthetic-key'})).rejects.toThrow('International delivery');expect(s.prisma.marketplaceCart.findUnique).not.toHaveBeenCalled();
  });
  it('delivery response reflects completed root order without releasing earnings by default',async()=>{
    const old=process.env.MARKETPLACE_DELIVERY_RELEASE_APPROVED;delete process.env.MARKETPLACE_DELIVERY_RELEASE_APPROVED;
    const tx:any={marketplaceSellerOrder:{updateMany:jest.fn().mockResolvedValue({count:1}),findUnique:jest.fn().mockResolvedValueOnce({id:'so',order:{status:'PROCESSING'}}).mockResolvedValueOnce({id:'so',order:{status:'COMPLETED'}}),count:jest.fn().mockResolvedValue(0)},marketplaceOrder:{update:jest.fn()},marketplaceSellerEarning:{updateMany:jest.fn()}};
    const s=service({marketplaceSellerOrder:{findFirst:jest.fn().mockResolvedValue({id:'so',orderId:'o',astrologerId:'a',status:'SHIPPED'})},$transaction:jest.fn(async f=>f(tx))});s.requireSellerAstrologer=jest.fn().mockResolvedValue({astrologer:{id:'a'}});
    try{const result=await s.deliverSellerOrder('s','so');expect(result.data.order.status).toBe('COMPLETED');expect(tx.marketplaceSellerEarning.updateMany).not.toHaveBeenCalled();}
    finally{if(old===undefined)delete process.env.MARKETPLACE_DELIVERY_RELEASE_APPROVED;else process.env.MARKETPLACE_DELIVERY_RELEASE_APPROVED=old;}
  });
});

describe('marketplace review cases (mock transactions only)', () => {
  let s:any,tx:any;
  beforeEach(()=>{
    process.env.MARKETPLACE_CASES_ENABLED='true';
    tx={marketplaceOrder:{findFirst:jest.fn().mockResolvedValue({id:'o',currency:'INR',status:'COMPLETED',paymentVerifiedAt:new Date(),grandTotal:new Prisma.Decimal(100)})},marketplaceOrderCase:{findUnique:jest.fn().mockResolvedValue(null),aggregate:jest.fn().mockResolvedValue({_sum:{amountMinor:0}}),create:jest.fn().mockImplementation(async ({data})=>data),updateMany:jest.fn().mockResolvedValue({count:1})},marketplaceCaseEvent:{create:jest.fn()}};
    s=new MarketplaceCaseService({$transaction:jest.fn(async f=>f(tx))} as any);s.actor=jest.fn().mockResolvedValue({id:'customer'});
  });
  afterEach(()=>{delete process.env.MARKETPLACE_CASES_ENABLED;});
  const dto={kind:'REFUND' as const,amountMinor:1000,reason:'Synthetic test request',idempotencyKey:'synthetic-key'};
  it('disabled by default, no persistence attempted', async ()=>{delete process.env.MARKETPLACE_CASES_ENABLED;await expect(s.create('s','o',dto)).rejects.toThrow('not enabled');expect(s.prisma.$transaction).not.toHaveBeenCalled();});
  it('records review and audit atomically, never a provider refund', async ()=>{const r=await s.create('s','o',dto);expect(r.data.status).toBeUndefined();expect(tx.marketplaceOrder.findFirst.mock.calls[0][0].where).toEqual({id:'o',customerUserId:'customer'});expect(r.data.events.create.action).toBe('REQUESTED');expect(s.prisma.$transaction.mock.calls[0][1].isolationLevel).toBe('Serializable');});
  it('denies cross-customer order',async()=>{tx.marketplaceOrder.findFirst.mockResolvedValue(null);await expect(s.create('s','o',dto)).rejects.toThrow();expect(tx.marketplaceOrderCase.create).not.toHaveBeenCalled();});
  it('denies unverified payment',async()=>{tx.marketplaceOrder.findFirst.mockResolvedValue({status:'PENDING_PAYMENT'});await expect(s.create('s','o',dto)).rejects.toThrow();});
  it('caps cumulative partial refund reviews at paid total',async()=>{tx.marketplaceOrderCase.aggregate.mockResolvedValue({_sum:{amountMinor:9500}});await expect(s.create('s','o',dto)).rejects.toThrow('exceeds');});
  it('rejects conflicting idempotency payload',async()=>{tx.marketplaceOrderCase.findUnique.mockResolvedValue({orderId:'other'});await expect(s.create('s','o',dto)).rejects.toThrow('Idempotency');});
  it('duplicate request returns original, creates no second case',async()=>{tx.marketplaceOrderCase.findUnique.mockResolvedValue({orderId:'o',kind:'REFUND',amountMinor:1000,reason:dto.reason});await s.create('s','o',dto);expect(tx.marketplaceOrderCase.create).not.toHaveBeenCalled();});
  it('approval is review only',async()=>{tx.marketplaceOrderCase.findUnique.mockResolvedValue({status:'REQUESTED',kind:'REFUND'});const r=await s.review('s','case',{status:'APPROVED'});expect(r.providerRefundExecuted).toBe(false);expect(tx.marketplaceCaseEvent.create).toHaveBeenCalled();expect(s.actor).toHaveBeenCalledWith('s',true);});
  it('cannot resolve refund as if payment had completed',async()=>{tx.marketplaceOrderCase.findUnique.mockResolvedValue({status:'REQUESTED',kind:'REFUND'});await expect(s.review('s','case',{status:'RESOLVED'})).rejects.toThrow();});
  it('concurrent review loses safely',async()=>{tx.marketplaceOrderCase.findUnique.mockResolvedValue({status:'REQUESTED',kind:'DISPUTE'});tx.marketplaceOrderCase.updateMany.mockResolvedValue({count:0});await expect(s.review('s','case',{status:'RESOLVED'})).rejects.toThrow('concurrently');expect(tx.marketplaceCaseEvent.create).not.toHaveBeenCalled();});
});
