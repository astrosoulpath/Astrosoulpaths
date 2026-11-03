import {ConsultationRepository} from './consultation.repository';
import {PrismaService} from '../../infrastructure/prisma/prisma.service';
describe('professional history ownership contract',()=>{
 it('keeps server ownership filtering and selects the proof required by the dashboard',async()=>{
  const findMany=jest.fn().mockResolvedValue([{id:'synthetic-call',astrologerId:'synthetic-astrologer'}]);
  const prisma={callSession:{findMany,count:jest.fn().mockResolvedValue(1)}};
  const result=await new ConsultationRepository(prisma as unknown as PrismaService).findAstrologerConsultationHistory('synthetic-astrologer',{page:1,limit:10});
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({astrologerId:'synthetic-astrologer'}),select:expect.objectContaining({id:true,astrologerId:true})}));
  expect(result.items[0].astrologerId).toBe('synthetic-astrologer');
 });
});
