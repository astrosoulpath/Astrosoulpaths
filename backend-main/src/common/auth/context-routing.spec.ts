jest.mock('./firebase-google-identity',()=>({verifyFirebaseGoogleIdentity:jest.fn()}));
// These context-token tests must never initialize provider SDKs or use JWKS.
// Fail closed if a regression accidentally enters an external verification path.
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn(()=>{throw Error('Unexpected Firebase provider call');})}));
jest.mock('jose',()=>({
  createRemoteJWKSet:jest.fn(()=>()=>{throw Error('Unexpected JWKS call');}),
  decodeProtectedHeader:jest.fn(()=>{throw Error('Unexpected external JWT path');}),
  jwtVerify:jest.fn(()=>{throw Error('Unexpected external JWT verification');}),
}));
import { verifyFirebaseGoogleIdentity } from './firebase-google-identity';
import { establishContextSession, contextIdentityReader } from './context-session';
import { SupabaseJwtService } from '../../infrastructure/supabase/supabase-jwt.service';
import { CommunicationAuthService } from '../../infrastructure/supabase/communication-auth.service';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { NotificationsIdentityGuard } from '../../module/notifications/notifications-identity.guard';
import { resolveSupportActor } from '../../module/support/support-policy';

describe('encrypted context through shared HTTP, support and socket verification (synthetic)',()=>{
  const original={...process.env};
  let db:any,user:any,jwt:SupabaseJwtService,users:any;
  beforeEach(()=>{
    process.env.AUTH_CONTEXT_SESSION_KEY='12'.repeat(32);delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
    process.env.ADMIN_ALLOWED_FIREBASE_UID='approved-fixture';
    user={id:'canonical',supabaseId:'canonical-subject',email:'fixture@example.invalid',role:{name:'ADMIN'},
      isActive:true,isBlocked:false,isAstrologer:true,astrologer:{isApproved:true,isVerified:true}};
    (verifyFirebaseGoogleIdentity as jest.Mock).mockReset().mockResolvedValue({uid:'approved-fixture',email:user.email,
      googleEmail:user.email,googleSubject:'google-fixture',tokenGoogleSubjects:['google-fixture'],signInProvider:'google.com',expiresAt:Date.now()/1000+3600|0});
    db={userAuthIdentity:{findUnique:jest.fn(async()=>({identityType:'google',email:user.email,user}))},
      user:{findMany:jest.fn(async()=>[user]),findUnique:jest.fn(async()=>user),update:jest.fn(),create:jest.fn()}};
    users={...contextIdentityReader(db),assertActiveAccount:jest.fn(),syncFirebaseEmailUser:jest.fn(),syncFirebasePhoneUser:jest.fn()};
    const config:any={getOrThrow:()=> 'https://synthetic.invalid',get:()=>undefined};
    jwt=new SupabaseJwtService(config,db);
  });
  afterEach(()=>{process.env={...original};});
  const token=async(context:'customer'|'astrologer'|'admin')=>(await establishContextSession('synthetic-source',context,users)).accessToken;
  function request(accessToken:string,path:string,roles?:string[]){
    const req:any={headers:{authorization:'Bearer '+accessToken},originalUrl:path};
    const context:any={getHandler:()=>()=>{},getClass:()=>class{},switchToHttp:()=>({getRequest:()=>req})};
    const reflector:any={getAllAndOverride:(key:string)=>key===ROLES_KEY?roles:false};
    return {req,context,guard:new SupabaseAuthGuard(reflector,jwt,users),roles:new RolesGuard(reflector,db)};
  }
  it('canonical Admin Customer context reaches customer support without Admin binding or synchronization',async()=>{
    const access=await token('customer');
    const communication=new CommunicationAuthService(jwt,db,{getClient:()=>{throw Error('Unexpected external call')}} as any,{get:()=>undefined} as any);
    const identity=await communication.verify(access);expect(identity.asp_account_role).toBe('CUSTOMER');expect(identity.sub).toBe(user.supabaseId);
    const r=request(access,'/support/tickets');
    await expect(new NotificationsIdentityGuard(communication,users).canActivate(r.context)).resolves.toBe(true);
    await expect(resolveSupportActor(db,r.req.user)).resolves.toMatchObject({id:user.id});
    expect(users.syncFirebaseEmailUser).not.toHaveBeenCalled();expect(db.user.update).not.toHaveBeenCalled();
  });
  it.each(['/admin/stats','/api/admin/stats','/astrologer/dashboard'])('Customer context is denied on %s without relying on UI role',async path=>{
    const r=request(await token('customer'),path);await expect(r.guard.canActivate(r.context)).rejects.toThrow();
  });
  it('Customer-scoped approved Admin cannot satisfy an Admin-only guard',async()=>{
    const r=request(await token('customer'),'/admin/stats',['ADMIN']);await expect(r.guard.canActivate(r.context)).rejects.toThrow();
  });
  it('approved Astrologer context retains original canonical subject and accesses approved routes',async()=>{
    const r=request(await token('astrologer'),'/astrologer/dashboard',['ASTROLOGER']);
    await expect(r.guard.canActivate(r.context)).resolves.toBe(true);await expect(r.roles.canActivate(r.context)).resolves.toBe(true);
    expect(r.req.user.sub).toBe(user.supabaseId);expect(r.req.user.asp_account_role).toBe('ASTROLOGER');
  });
  it('pending Astrologer may onboard but cannot use dashboard or role-specific APIs',async()=>{
    user.astrologer.isApproved=false;const access=await token('astrologer');
    const onboard=request(access,'/astrologer/onboarding-status');await expect(onboard.guard.canActivate(onboard.context)).resolves.toBe(true);
    const dashboard=request(access,'/astrologer/dashboard');await expect(dashboard.guard.canActivate(dashboard.context)).rejects.toThrow();
    const other=request(access,'/calls/token',['ASTROLOGER']);await expect(other.guard.canActivate(other.context)).rejects.toThrow();
  });
  it('Admin context cannot replay as a customer role',async()=>{
    const r=request(await token('admin'),'/customer-only',['CUSTOMER']);await expect(r.guard.canActivate(r.context)).resolves.toBe(true);
    await expect(r.roles.canActivate(r.context)).rejects.toThrow();
  });
  it('raw Firebase bearer cannot satisfy Admin guard',async()=>{
    const r=request('synthetic-source','/admin/stats',['ADMIN']);await expect(r.guard.canActivate(r.context)).rejects.toThrow();
    expect(users.syncFirebaseEmailUser).not.toHaveBeenCalled();
  });
  it('revocation or block after issuance invalidates shared verification',async()=>{
    const access=await token('customer');user.isBlocked=true;await expect(jwt.verifyAccessToken(access)).rejects.toThrow();
    user.isBlocked=false;(verifyFirebaseGoogleIdentity as jest.Mock).mockRejectedValue(Error('private-provider-error'));
    await expect(jwt.verifyAccessToken(access)).rejects.toThrow('Invalid or expired context session');
  });
});
