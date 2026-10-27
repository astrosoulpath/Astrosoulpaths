import { MarketplacePaymentsService } from './marketplace-payments.service';
describe('marketplace payment port',()=>{
  it('preserves authoritative creation contract and gate',async()=>{const createMarketplaceRazorpayOrder=jest.fn().mockRejectedValue(new Error('disabled'));const s=new MarketplacePaymentsService({createMarketplaceRazorpayOrder} as any);await expect(s.createOrder('canonical','order')).rejects.toThrow('disabled');expect(createMarketplaceRazorpayOrder).toHaveBeenCalledWith('canonical','order');});
  it('delegates receipt verification without accepting client totals',async()=>{const verifyMarketplaceRazorpayPayment=jest.fn().mockResolvedValue({success:true});const s=new MarketplacePaymentsService({verifyMarketplaceRazorpayPayment} as any);const receipt={razorpayOrderId:'o',razorpayPaymentId:'p',razorpaySignature:'synthetic'};await s.verifyPayment('canonical','order',receipt);expect(verifyMarketplaceRazorpayPayment).toHaveBeenCalledWith('canonical','order',receipt);});
  it('cannot execute or fabricate a provider refund',async()=>{await expect(new MarketplacePaymentsService({} as any).refund()).rejects.toThrow('approved adapter');});
});
