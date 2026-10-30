import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
jest.mock('firebase-admin/auth',()=>({getAuth:jest.fn()}));
jest.mock('jose',()=>({createRemoteJWKSet:jest.fn(),decodeProtectedHeader:jest.fn(),jwtVerify:jest.fn()}));

describe('ProfileController', () => {
  let controller: ProfileController;
  const service={uploadAvatar:jest.fn()};

  beforeEach(() => {controller=new ProfileController(service as unknown as ProfileService);jest.clearAllMocks();});

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('opts out of AI generation only when explicitly requested, preserving legacy defaults',()=>{
    controller.uploadAvatar({sub:'fixture'} as never,{} as never,'false');expect(service.uploadAvatar).toHaveBeenLastCalledWith('fixture',{},false);
    controller.uploadAvatar({sub:'fixture'} as never,{} as never);expect(service.uploadAvatar).toHaveBeenLastCalledWith('fixture',{},true);
    expect(()=>controller.uploadAvatar({sub:'fixture'} as never,{} as never,'invalid')).toThrow();
  });
});
