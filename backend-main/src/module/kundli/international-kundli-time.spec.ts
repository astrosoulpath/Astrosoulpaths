import { KundliService } from './kundli.service';

describe('new Kundli requests use stored IANA birth zone without rewriting history', () => {
  const profile = { id:'synthetic-profile',fullName:'Synthetic',gender:'OTHER',dateOfBirth:new Date('2024-01-15T00:00:00Z'),timeOfBirth:'10:00',latitude:40.7,longitude:-74,timezone:-4,timezoneName:'America/New_York',city:'Synthetic' };
  function setup(value: any) {
    const db={userAuthIdentity:{findUnique:async()=>null},user:{findFirst:async()=>({id:'synthetic',isActive:true,isBlocked:false,userProfile:value})}};
    const service=new KundliService({} as never,{} as never,db as never,{} as never);
    const generate=jest.spyOn(service,'generateReport').mockResolvedValue({kundli:{},report:{},source:'synthetic'} as never);
    return {service,generate};
  }
  it('normalizes the historical offset before report/cache lookup and preserves stored profile',async()=>{
    const {service,generate}=setup(profile);const result=await service.generateMyKundli('synthetic');
    expect(generate.mock.calls[0][0].timezone).toBe(-5);expect(result.profile.timezone).toBe(-5);expect(profile.timezone).toBe(-4);
  });
  it('rejects nonexistent wall time before calculation',async()=>{
    const {service,generate}=setup({...profile,dateOfBirth:new Date('2024-03-10T00:00:00Z'),timeOfBirth:'02:30'});
    await expect(service.generateMyKundli('synthetic')).rejects.toThrow('invalid or ambiguous');expect(generate).not.toHaveBeenCalled();
  });
  it('preserves legacy numeric-only profiles',async()=>{
    const {service,generate}=setup({...profile,timezoneName:null});await service.generateMyKundli('synthetic');expect(generate.mock.calls[0][0].timezone).toBe(-4);
  });
});
