jest.mock('firebase-admin/app',()=>({cert:jest.fn(),getApps:jest.fn(()=>[]),initializeApp:jest.fn()}));
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
import {UserService} from './user.service';
describe('Canonical onboarding reads and partial updates',()=>{
 it('returns the canonical phone without writing during GET',async()=>{
  const db={user:{findUnique:jest.fn().mockResolvedValue({id:'owner',phone:'+919876543210',isProfileComplete:false,userProfile:{id:'profile',phoneNumber:null}})},userProfile:{update:jest.fn()},userAuthIdentity:{findFirst:jest.fn().mockResolvedValue(null)}};
  const service=Object.create(UserService.prototype);Object.assign(service,{prisma:db});jest.spyOn(service as any,'resolveCanonicalUserId').mockResolvedValue('owner');
  const result=await service.getProfile('provider');expect(result.data?.phoneNumber).toBe('+919876543210');expect(db.userProfile.update).not.toHaveBeenCalled();expect(result.capabilities.photoUploadWithoutAi).toBe(true);
 });
 it('does not reset unknown birth time on an unrelated partial patch',()=>{const service=Object.create(UserService.prototype);expect(service.buildUpdateUserProfileData({avatarUrl:'https://fixture.invalid/avatar.png'}).birthTimeKnown).toBeUndefined();});
 it('updates and reads the same owned profile while preserving unknown time and zero coordinates',async()=>{
  const profile:any={id:'profile',userId:'owner',fullName:'Original',dateOfBirth:new Date('2000-01-01'),birthTimeKnown:false,timeOfBirth:null,gender:'OTHER',city:'Fixture',countryCode:'IN',latitude:0,longitude:0,timezone:0};
  const account={id:'owner',phone:null,isProfileComplete:true,userProfile:profile};const db:any={user:{findUnique:jest.fn(async()=>account),update:jest.fn(async({data})=>Object.assign(account,data))},userProfile:{update:jest.fn(async({where,data})=>{expect(where).toEqual({userId:'owner'});for(const [key,value]of Object.entries(data))if(value!==undefined)profile[key]=value;return profile;})},userAuthIdentity:{findFirst:jest.fn().mockResolvedValue(null)},$transaction:jest.fn()};db.$transaction.mockImplementation(callback=>callback(db));
  const service=Object.create(UserService.prototype);Object.assign(service,{prisma:db});jest.spyOn(service as any,'resolveCanonicalUserId').mockResolvedValue('owner');
  const saved=await service.updateProfile('provider',{fullName:'Updated'});const read=await service.getProfile('provider');expect(saved.isProfileComplete).toBe(true);expect(read.data?.fullName).toBe('Updated');expect(read.data?.birthTimeKnown).toBe(false);expect(read.data?.latitude).toBe(0);expect(read.data?.id).toBe('profile');
 });
});
