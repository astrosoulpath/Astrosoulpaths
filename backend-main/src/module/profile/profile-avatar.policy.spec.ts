import {profileImageMime} from './profile-avatar.policy';
import {ProfileService} from './profile.service';
describe('Canonical nonbillable customer photo integration',()=>{
 const bytes=Buffer.from([137,80,78,71,13,10,26,10,1]);
 const image={buffer:bytes,size:bytes.length,mimetype:'image/png',originalname:'fixture.png'};
 it('accepts real supported bytes and rejects spoofed content, mismatch and size',()=>{expect(profileImageMime(image)).toBe('image/png');for(const file of [{...image,buffer:Buffer.from('<html>')},{...image,mimetype:'image/jpeg'},{...image,size:0}])expect(()=>profileImageMime(file)).toThrow();});
 it('uploads against the canonical linked account and can skip AI generation',async()=>{
  const upload=jest.fn().mockResolvedValue({}),ai={generateForUser:jest.fn()},db={userAuthIdentity:{findUnique:jest.fn().mockResolvedValue({userId:'canonical'})},user:{findUnique:jest.fn().mockResolvedValue({id:'canonical',avatarUrl:null}),update:jest.fn()}};
  const service=new ProfileService(db as never,{getStorageClient:()=>({storage:{from:()=>({upload,getPublicUrl:()=>({data:{publicUrl:'https://fixture.invalid/photo.png'}})})}})} as never,{} as never,{} as never,ai as never);
  jest.spyOn(service as any,'removePreviousAvatarFromStorage').mockResolvedValue(undefined);
  const result=await service.uploadAvatar('linked-provider-subject',image as never,false);expect(result.data.avatarUrl).toBe('https://fixture.invalid/photo.png');expect(db.user.findUnique).toHaveBeenCalledWith({where:{id:'canonical'},select:{id:true,avatarUrl:true}});expect(ai.generateForUser).not.toHaveBeenCalled();expect(upload.mock.calls[0][0]).toMatch(/^canonical\//);
 });
});
