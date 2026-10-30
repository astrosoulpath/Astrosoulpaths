import {AstrologerService} from './astrologer.service';
describe('professional dashboard reporting parity (read only)',()=>{
 it('uses one explicit UTC day, canonical ownership and separate currencies without financial writes',async()=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-10-29T20:30:00Z'));
  try{const groupBy=jest.fn(async query=>query.where.createdAt?[{currency:'USD',_sum:{netAmount:1}},{currency:'INR',_sum:{netAmount:70}}]:[{currency:'INR',_sum:{netAmount:140}}]);
   const count=jest.fn(async query=>query.where.status==='PENDING'?3:query.where.status==='ACTIVE'?2:query.where.status?.in?5:1);
   const db:any={astrologerEarning:{groupBy},callSession:{count},$transaction:jest.fn(values=>Promise.all(values))};const service=new AstrologerService(db,{} as any,{} as any);
   jest.spyOn(service as any,'findAstrologerBySupabaseId').mockResolvedValue({id:'profile-fixture',user:{id:'canonical-professional',name:'Synthetic'},bio:'Description',languages:['English'],expertise:[],pricePerMin:10,documents:{},isApproved:true,isVerified:true,isOnline:false});
   const result=await service.getDashboard('verified-subject');expect(result.data.reportingTimezone).toBe('UTC');expect(result.data.reportingDate).toBe('2026-10-29');expect(result.data.activeConsultations).toBe(2);expect(result.data.completedConsultations).toBe(5);expect(result.data.pendingConsultations).toBe(3);expect(result.data.todayEarningsByCurrency).toEqual([{currency:'USD',amount:1},{currency:'INR',amount:70}]);expect(result.data.pricingCurrency).toBe('INR');expect(result.data.scheduleSupported).toBe(false);
   for(const [query] of count.mock.calls){expect(query.where.astrologerId).toBe('canonical-professional');if(query.where.mode)expect(query.where.createdAt).toEqual({gte:new Date('2026-10-29T00:00:00Z'),lt:new Date('2026-10-30T00:00:00Z')});}
   expect(groupBy.mock.calls[1][0].where.astrologerId).toBe('profile-fixture');expect(groupBy.mock.calls[1][0].by).toEqual(['currency']);expect(groupBy.mock.calls[1][0].where.status.in).not.toContain('REVERSED');
  }finally{jest.useRealTimers();}
 });
});
