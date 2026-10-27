jest.mock('jose',()=>({createRemoteJWKSet:jest.fn(),jwtVerify:jest.fn()}));
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
import { AdminProductRefundController } from './admin-product-refund.controller';
describe('product refund HTTP boundary',()=>{
  it.each(['prepare','submit','reconcile'] as const)('rejects forged Admin request on %s before service calls',method=>{
    const service:any={prepare:jest.fn(),submit:jest.fn(),reconcile:jest.fn()};
    const controller=new AdminProductRefundController(service);
    expect(()=>controller[method]({user:{id:'synthetic-admin',sub:'synthetic-admin',role:'ADMIN'}},'synthetic-order',{reason:'Synthetic explicit refund'})).toThrow('Verified Firebase Admin context');
    expect(service[method]).not.toHaveBeenCalled();
  });
});
