import {validate} from 'class-validator';
import {EmailSignupDto} from './dto/email-signup.dto';
import {UserService} from '../user/user.service';
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
jest.mock('jose',()=>({createRemoteJWKSet:jest.fn(),decodeProtectedHeader:jest.fn(),jwtVerify:jest.fn()}));
describe('Email-only registration and canonical account protection',()=>{
 it('accepts Unicode names without a phone, but validates any provided phone',async()=>{
  const dto=Object.assign(new EmailSignupDto(),{fullName:'Élodie Nguyễn',email:'fixture@example.invalid',password:'Synthetic1!'});
  expect(await validate(dto)).toHaveLength(0);dto.phone='invalid';expect((await validate(dto)).some(error=>error.property==='phone')).toBe(true);
 });
 it('refuses an existing canonical email before provider creation',async()=>{
  const db={user:{findFirst:jest.fn().mockResolvedValue({id:'existing'})}};
  const service=Object.create(UserService.prototype);Object.assign(service,{prisma:db});
  await expect(service.assertEmailSignupAvailable('fixture@example.invalid')).rejects.toThrow();
  expect(db.user.findFirst).toHaveBeenCalledWith({where:{email:{equals:'fixture@example.invalid',mode:'insensitive'}},select:{id:true}});
 });
 it('does not mutate any user while checking a new email',async()=>{
  const db={user:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn(),update:jest.fn()}};
  const service=Object.create(UserService.prototype);Object.assign(service,{prisma:db});await service.assertEmailSignupAvailable('fixture@example.invalid');expect(db.user.create).not.toHaveBeenCalled();expect(db.user.update).not.toHaveBeenCalled();
 });
});
