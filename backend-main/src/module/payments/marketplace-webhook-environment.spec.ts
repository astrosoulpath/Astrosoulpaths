import { PaymentsService } from './payments.service';
import { getRazorpayInstance } from '../../config/razorpay.config';
jest.mock('../../config/razorpay.config',()=>({getRazorpayInstance:jest.fn()}));
describe('marketplace signed-webhook environment boundary (isolated)',()=>{
 function fixture(){
  const payment={id:'pay_synthetic',order_id:'order_synthetic',amount:10000,currency:'INR',status:'captured',captured:true};
  const evidence={...payment};
  const provider={payments:{fetch:jest.fn().mockResolvedValue(evidence)}};
  (getRazorpayInstance as jest.Mock).mockReturnValue(provider);
  const marketplace:any={findMarketplaceOrderForRazorpayWebhook:jest.fn().mockResolvedValue({id:'marketplace-order',orderNumber:'synthetic'}),finalizeMarketplaceRazorpayWebhook:jest.fn().mockResolvedValue({status:'success'}),isMarketplaceRefundRequiredFinalizationError:jest.fn().mockReturnValue(false)};
  const service=new PaymentsService({} as any,{} as any,{} as any,marketplace,{} as any,{} as any);
  const event:any={event:'payment.captured',payload:{payment:{entity:payment}}};
  return {provider,evidence,marketplace,service,event};
 }
 afterEach(()=>jest.resetAllMocks());
 it('configured provider account must confirm the capture before fulfillment',async()=>{const f=fixture();expect(await f.service.processVerifiedWebhook(f.event)).toEqual({status:'success'});expect(f.provider.payments.fetch).toHaveBeenCalledWith('pay_synthetic');expect(f.marketplace.finalizeMarketplaceRazorpayWebhook).toHaveBeenCalledTimes(1);});
 it.each([{id:'pay_other'},{order_id:'order_other'},{amount:9999},{currency:'USD'},{status:'authorized'},{captured:false}])('mismatched provider evidence never reaches fulfillment %j',async patch=>{const f=fixture();Object.assign(f.evidence,patch);await expect(f.service.processVerifiedWebhook(f.event)).rejects.toThrow('configured provider');expect(f.marketplace.finalizeMarketplaceRazorpayWebhook).not.toHaveBeenCalled();});
 it('wrong merchant/environment, disabled LIVE gate or provider failure stays unfulfilled',async()=>{const f=fixture();(getRazorpayInstance as jest.Mock).mockImplementationOnce(()=>{throw Error('private provider configuration');});await expect(f.service.processVerifiedWebhook(f.event)).rejects.toThrow('evidence unavailable');expect(f.marketplace.finalizeMarketplaceRazorpayWebhook).not.toHaveBeenCalled();});
});
