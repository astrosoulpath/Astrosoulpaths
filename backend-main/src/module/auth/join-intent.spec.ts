jest.mock('jose',()=>({createRemoteJWKSet:jest.fn(),jwtVerify:jest.fn()}));
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
jest.mock('../../common/auth/firebase-google-identity',()=>({verifyFirebaseGoogleIdentity:jest.fn(async()=>({uid:'synthetic-firebase',email:'synthetic@example.invalid',signInProvider:'password'}))}));
jest.mock('../../common/auth/context-session',()=>({assertContextConfigured:jest.fn(),establishContextSession:jest.fn(async(_token:string,context:string)=>({authContext:context}))}));
import {AuthService} from './auth.service';

function fixture(){
 const getSessionState=jest.fn(async(_id:string,portal:string)=>({success:true,portal,role:'ASTROLOGER_APPLICANT',user:{id:'synthetic-canonical',portal}}));
 const userService={getUserByFirebaseUid:jest.fn(async()=>({isActive:true,isBlocked:false,isAstrologer:false,supabaseId:'synthetic-canonical'})),getSessionState};
 const service=Object.create(AuthService.prototype) as AuthService;
 Object.defineProperty(service,'userService',{value:userService});return {service,userService};
}
describe('explicit applicant context',()=>{
 it('returns a normal astrologer portal descriptor for explicit join intent',async()=>{const {service,userService}=fixture();const result=await service.loginFirebaseContext('synthetic-proof','joinAstrologer');expect(result).toMatchObject({portal:'astrologer',role:'ASTROLOGER_APPLICANT',authContext:'astrologer',user:{id:'synthetic-canonical',portal:'astrologer'}});expect(userService.getSessionState).toHaveBeenCalledWith('synthetic-canonical','astrologer');});
 it('does not turn existing-professional login into applicant registration',async()=>{const {service,userService}=fixture();await expect(service.loginFirebaseContext('synthetic-proof','astrologer')).rejects.toThrow('Use Join as Astrologer');expect(userService.getSessionState).not.toHaveBeenCalled();});
});
