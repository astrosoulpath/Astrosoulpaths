import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserController } from './user.controller';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({ SupabaseJwtService: class {} }));

describe('account deletion remains fail-closed pending approved policy',()=>{
  it('readiness is authenticated and explicitly records no request',()=>{
    expect(Reflect.getMetadata(GUARDS_METADATA,UserController.prototype.deletionReadiness)).toContain(SupabaseAuthGuard);
    const controller=new UserController({} as never);const result=controller.deletionReadiness();
    expect(result.data).toMatchObject({available:false,status:'NOT_ENABLED',recentReauthenticationRequired:true});
    expect(result.data.blockers).toHaveLength(3);expect(result.data.message).toContain('No deletion request');
  });
  it('missing confirmation and repeated confirmed requests never mutate data',async()=>{
    const userService={delete:jest.fn()};const controller=new UserController(userService as never);
    await expect(controller.deleteAccount({sub:'synthetic'},undefined)).rejects.toThrow('confirmation');
    for(let i=0;i<2;i++)await expect(controller.deleteAccount({sub:'synthetic'},'DELETE')).rejects.toThrow('unavailable');
    expect(userService.delete).not.toHaveBeenCalled();
  });
});
