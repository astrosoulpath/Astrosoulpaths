import {AstrologerService} from './astrologer.service';
describe('Private KYC storage fail-closed policy',()=>{
 it('bounds website document lookups before any storage or database access',async()=>{
  const service=new AstrologerService({} as never,{} as never,{} as never);
  await expect(service.register('subject',{fullName:'Fixture',languages:['English'],expertise:['Vedic'],documents:{certificates:Array.from({length:11},()=>({type:'certificate',name:'fixture.pdf',url:'owner/certificate/fixture.pdf'}))}} as never,{countryCode:'IN'})).rejects.toThrow('supported limits');
 });
 it.each([{data:{public:true}},{data:null,error:{message:'sensitive'}},{data:{public:false},error:{message:'sensitive'}}])('rejects a public/unverified bucket',async result=>{
  const from=jest.fn();const service=new AstrologerService({} as never,{getStorageClient:()=>({storage:{getBucket:async()=>result,from}})} as never,{} as never);
  await expect((service as any).privateKycStorage()).rejects.toThrow('Private KYC storage is not verified');expect(from).not.toHaveBeenCalled();
 });
 it('opens only the confirmed private bucket',async()=>{
  const from=jest.fn().mockReturnValue({});const service=new AstrologerService({} as never,{getStorageClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from}})} as never,{} as never);
  await (service as any).privateKycStorage();expect(from).toHaveBeenCalledWith('astrologer-kyc');
 });
});
