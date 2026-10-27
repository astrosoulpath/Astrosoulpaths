import { Prisma } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceCheckoutStore, checkoutDigest } from './marketplace-checkout-store';
describe('Stage 4 accounting integration safeguards (synthetic mocks)',()=>{
 const keys=['MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED','MARKETPLACE_PAYOUT_REQUESTS_ENABLED'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 afterEach(()=>{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}});
 function fixture(existing=false) {
  const tx={marketplaceOrder:{findFirst:jest.fn().mockResolvedValue({id:'order',sellerOrders:[{id:'seller',astrologerId:'astro',currency:'INR',subtotal:new Prisma.Decimal(140),earning:existing?{id:'existing'}:null}]})},$queryRaw:jest.fn().mockResolvedValue([{payload:[{sellerOrderId:'seller',amounts:{currency:'INR',productMinor:10000,discountMinor:1000,shippingMinor:3000,taxMinor:2000,feeMinor:0}}]}]),marketplaceSellerEarning:{create:jest.fn()}};
  const service=new MarketplaceService({} as any,{} as any) as any;
  return {tx,service};
 }
 it('existing earning projection uses the same net product base as the new journal, excluding shipping and tax',async()=>{
  process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED='true';const {tx,service}=fixture();
  await service.createMarketplaceEarningsAfterVerifiedPayment(tx,'order');
  const data=tx.marketplaceSellerEarning.create.mock.calls[0][0].data;
  expect(data.grossAmount.toString()).toBe('90');expect(data.platformFeeAmount.toString()).toBe('27');expect(data.netAmount.toString()).toBe('63');expect(data.status).toBe('PENDING');
 });
 it('leaves historical commission path unchanged with new gate off',async()=>{
  delete process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED;const {tx,service}=fixture();
  await service.createMarketplaceEarningsAfterVerifiedPayment(tx,'order');
  expect(tx.$queryRaw).not.toHaveBeenCalled();expect(tx.marketplaceSellerEarning.create.mock.calls[0][0].data.grossAmount.toString()).toBe('140');
 });
 it('does not create duplicate earning projections',async()=>{
  process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED='true';const {tx,service}=fixture(true);
  await service.createMarketplaceEarningsAfterVerifiedPayment(tx,'order');expect(tx.marketplaceSellerEarning.create).not.toHaveBeenCalled();
 });
 it('fails closed rather than guessing historical tax allocation',async()=>{
  process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED='true';const {tx,service}=fixture();tx.$queryRaw.mockResolvedValue([]);
  await expect(service.createMarketplaceEarningsAfterVerifiedPayment(tx,'order')).rejects.toThrow('snapshot');expect(tx.marketplaceSellerEarning.create).not.toHaveBeenCalled();
 });
 it('blocks legacy payout totals while journal refunds are enabled',async()=>{
  Object.assign(process.env,{MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED:'true',MARKETPLACE_PAYOUT_REQUESTS_ENABLED:'true'});
  const db={$transaction:jest.fn()},service=new MarketplaceService(db as any,{} as any) as any;
  service.requireSellerAstrologer=jest.fn().mockResolvedValue({astrologer:{id:'synthetic'}});
  await expect(service.requestSellerMarketplacePayout('synthetic')).rejects.toThrow('Journal-based');expect(db.$transaction).not.toHaveBeenCalled();
 });
 it('reconciles a matching already-bound provider order without issuing a second order',async()=>{
  const db={$executeRaw:jest.fn().mockResolvedValue(0),$queryRaw:jest.fn().mockResolvedValue([{providerOrderId:'order_synthetic'}])};
  await new MarketplaceCheckoutStore(db as any).bindProviderOrder('order','order_synthetic');
  await expect(new MarketplaceCheckoutStore(db as any).bindProviderOrder('order','order_foreign')).rejects.toThrow('reconciliation');
 });
 it('canonical digest is stable across JSONB object key ordering and detects mutation',()=>{
  expect(checkoutDigest({a:1,b:[{x:2,y:3}]})).toBe(checkoutDigest({b:[{y:3,x:2}],a:1}));
  expect(checkoutDigest({a:1})).not.toBe(checkoutDigest({a:2}));
 });
});
