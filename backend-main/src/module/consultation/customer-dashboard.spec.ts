import { ConsultationRepository } from './consultation.repository';
describe('Customer dashboard read-only all-history summary',()=>{
 it('scopes every aggregate to canonical customer and excludes pending/expired/free reservations from spend',async()=>{
 const calls:any[]=[];const prisma:any={callSession:{count:jest.fn((q:any)=>{calls.push(q);return Promise.resolve(q.where.status==='ACTIVE'?2:3);}),aggregate:jest.fn((q:any)=>{calls.push(q);return Promise.resolve({_sum:{amountCharged:42}});})},$transaction:jest.fn((queries:any[])=>Promise.all(queries))};
 const value=await new ConsultationRepository(prisma).customerDashboardSummary('synthetic-customer');expect(value).toEqual({active:2,completed:3,recordedSpend:42,currency:'INR'});
 expect(calls.every(q=>q.where.userId==='synthetic-customer')).toBe(true);expect(calls[0].where.endedAt).toBeNull();expect(calls[0].where.expiresAt.gt).toBeInstanceOf(Date);expect(calls[2].where.status.in).toEqual(['COMPLETED','ENDED']);expect(prisma.callSession.update).toBeUndefined();
 });
 it('returns genuine zero for empty records and rejects missing identity before reads',async()=>{const prisma:any={callSession:{count:jest.fn().mockResolvedValue(0),aggregate:jest.fn().mockResolvedValue({_sum:{amountCharged:null}})},$transaction:jest.fn((q:any[])=>Promise.all(q))};const repo=new ConsultationRepository(prisma);await expect(repo.customerDashboardSummary('')).rejects.toThrow();expect(prisma.$transaction).not.toHaveBeenCalled();expect((await repo.customerDashboardSummary('synthetic')).recordedSpend).toBe(0);});
});
