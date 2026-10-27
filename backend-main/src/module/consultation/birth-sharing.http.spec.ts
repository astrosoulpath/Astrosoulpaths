jest.mock('../../infrastructure/supabase/communication-auth.service', () => ({ CommunicationAuthService: class {} }));
jest.mock('../../infrastructure/supabase/supabase.module', () => ({ SupabaseModule: class {} }));
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { CommunicationAuthService } from '../../infrastructure/supabase/communication-auth.service';
import { ConsultationKundliAuthGuard } from '../kundli/guards/consultation-kundli-auth.guard';
import { BirthSharingController } from './birth-sharing.module';
import { BirthSharingService } from './birth-sharing.service';

describe('birth sharing HTTP contract (synthetic authentication)', () => {
  let app: INestApplication;
  const access = jest.fn().mockResolvedValue({state:'NOT_SHARED',isCustomer:true,details:null});
  const verify = jest.fn(async (token: string) => {
    if (token !== 'synthetic') throw new UnauthorizedException('Authentication required');
    return {sub:'synthetic-canonical',asp_user_id:'customer',exp:Date.now()/1000+60};
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({controllers:[BirthSharingController],providers:[
      ConsultationKundliAuthGuard, {provide:CommunicationAuthService,useValue:{verify}},
      {provide:BirthSharingService,useValue:{access}},
    ]}).compile();
    app = module.createNestApplication(); await app.init();
  });
  beforeEach(() => { access.mockClear(); verify.mockClear(); });
  afterAll(async () => { await app.close(); });
  it.each([undefined,'Bearer local-dev-token:any','Bearer revoked'])('rejects unauthorized HTTP %s',async authorization=>{
    let test=request(app.getHttpServer()).get('/consultations/synthetic/birth-sharing');
    if (authorization) test=test.set('Authorization',authorization);
    await test.expect(401); expect(access).not.toHaveBeenCalled();
  });
  it('uses canonical actor and selected profile, with private no-store response',async()=>{
    const response=await request(app.getHttpServer()).get('/consultations/synthetic/birth-sharing?profileRef=saved%3Afamily').set('Authorization','Bearer synthetic').expect(200);
    expect(response.headers['cache-control']).toBe('no-store, private');
    expect(access).toHaveBeenCalledWith('customer','synthetic','read',undefined,undefined,'saved:family');
  });
  it('forwards reviewed consent scope, never client actor identity',async()=>{
    await request(app.getHttpServer()).post('/consultations/synthetic/birth-sharing/grant').set('Authorization','Bearer synthetic').send({actorId:'stranger',policyVersion:'v2',birthVersion:'reviewed',profileRef:'saved:family',revision:2}).expect(201);
    expect(access).toHaveBeenCalledWith('customer','synthetic','grant','v2','reviewed','saved:family',2);
  });
  it('revoke remains customer scoped',async()=>{
    await request(app.getHttpServer()).post('/consultations/synthetic/birth-sharing/revoke').set('Authorization','Bearer synthetic').send({actorId:'stranger'}).expect(201);
    expect(access).toHaveBeenCalledWith('customer','synthetic','revoke');
  });
});
