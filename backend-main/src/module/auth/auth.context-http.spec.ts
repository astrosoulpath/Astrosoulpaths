jest.mock('firebase-admin/app',()=>({getApps:jest.fn(),initializeApp:jest.fn(),cert:jest.fn()}));
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
import { Controller, INestApplication, Post, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsRoutingService } from './sms-routing.service';
import { ContextRateGuard } from '../../common/auth/context-rate.guard';
@Controller('legacy-status-fixture')
class LegacyPostFixture { @Post() reply(){return {success:true};} }
describe('context renewal actual HTTP contract (synthetic, no workers/database)',()=>{
  let app:INestApplication;let service:any;
  beforeAll(async()=>{
    service={loginFirebaseContext:jest.fn().mockResolvedValue({success:true,portal:'customer',role:'CUSTOMER',
      user:{id:'synthetic',authContext:'customer',firebaseUid:'synthetic-uid'},
      session:{accessToken:'aspctx.synthetic',authProvider:'asp-context',authContext:'customer',expiresIn:900}})};
    const module=await Test.createTestingModule({controllers:[AuthController,LegacyPostFixture],providers:[
      {provide:AuthService,useValue:service},{provide:SmsRoutingService,useValue:{}},
    ]}).overrideGuard(ContextRateGuard).useValue({canActivate:()=>true}).compile();
    app=module.createNestApplication();app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();
  });
  afterAll(async()=>{await app?.close();});
  it('reproduces Nest default 201 which the previous Flutter renewal rejected',async()=>{
    await request(app.getHttpServer()).post('/legacy-status-fixture').send({}).expect(201);
  });
  it('renewal explicitly returns 200 and existing-mapping-only Customer contract',async()=>{
    const result=await request(app.getHttpServer()).post('/auth/context/refresh').send({idToken:'synthetic-proof',portal:'customer'}).expect(200);
    expect(result.body.session).toMatchObject({authProvider:'asp-context',authContext:'customer'});
    expect(service.loginFirebaseContext).toHaveBeenCalledWith('synthetic-proof','customer',undefined,true);
  });
  it.each([{}, {idToken:'synthetic',portal:'admin'},{idToken:'synthetic',portal:'customer',role:'ADMIN'}])('rejects invalid/privilege-injection renewal payload',async body=>{
    const before=service.loginFirebaseContext.mock.calls.length;
    await request(app.getHttpServer()).post('/auth/context/refresh').send(body).expect(400);
    expect(service.loginFirebaseContext).toHaveBeenCalledTimes(before);
  });
});
