import { ContextRateGuard } from './context-rate.guard';
describe('bounded context verification rate guard',()=>{
  afterEach(()=>jest.useRealTimers());
  const ctx=(ip:string):any=>({switchToHttp:()=>({getRequest:()=>({socket:{remoteAddress:ip},headers:{'x-forwarded-for':'forged'}})})});
  it('limits expensive verification without storing credentials and expires the window',()=>{
    jest.useFakeTimers();const guard=new ContextRateGuard(),request=ctx('synthetic-peer');
    for(let i=0;i<120;i++)expect(guard.canActivate(request)).toBe(true);
    expect(()=>guard.canActivate(request)).toThrow('Too many');
    expect(guard.canActivate(ctx('other-peer'))).toBe(true);
    jest.setSystemTime(Date.now()+60001);expect(guard.canActivate(request)).toBe(true);
  });
  it('fails closed when the transport peer cannot be established',()=>{
    expect(()=>new ContextRateGuard().canActivate({switchToHttp:()=>({getRequest:()=>({headers:{'x-forwarded-for':'spoof'}})})} as any)).toThrow();
  });
});
