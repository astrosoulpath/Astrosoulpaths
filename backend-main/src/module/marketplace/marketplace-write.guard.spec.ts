import { MarketplaceWriteGuard } from './marketplace-write.guard';

describe('marketplace mutation limits',()=>{
  const context=(subject='synthetic',method='POST')=>({switchToHttp:()=>({getRequest:()=>({method,user:{sub:subject}})})}) as any;
  it('allows reads without mutation accounting',()=>expect(new MarketplaceWriteGuard().canActivate(context('','GET'))).toBe(true));
  it('does not trust an anonymous write',()=>expect(()=>new MarketplaceWriteGuard().canActivate(context(''))).toThrow());
  it('bounds each subject separately',()=>{const g=new MarketplaceWriteGuard();for(let i=0;i<60;i++)expect(g.canActivate(context())).toBe(true);expect(()=>g.canActivate(context())).toThrow();expect(g.canActivate(context('other'))).toBe(true);});
  it('expires buckets after the window',()=>{jest.spyOn(Date,'now').mockReturnValue(0);const g=new MarketplaceWriteGuard();for(let i=0;i<60;i++)g.canActivate(context());jest.spyOn(Date,'now').mockReturnValue(60000);expect(g.canActivate(context())).toBe(true);jest.restoreAllMocks();});
});
