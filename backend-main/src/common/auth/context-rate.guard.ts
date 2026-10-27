import { CanActivate, ExecutionContext, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';

/** Local bound on expensive Firebase verification. Production also needs a
 * shared edge/distributed limit; this per-process guard is not a cluster quota. */
@Injectable()
export class ContextRateGuard implements CanActivate {
  private static readonly windows=new Map<string,{start:number,count:number}>();
  canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest();
    // Never trust an unconfigured X-Forwarded-For header or use token contents.
    const address=request.socket?.remoteAddress;
    if(typeof address!=='string')throw new ServiceUnavailableException('Authentication peer unavailable');
    const now=Date.now();
    for(const [key,value] of ContextRateGuard.windows){if(now-value.start>=60000)ContextRateGuard.windows.delete(key);}
    let window=ContextRateGuard.windows.get(address);
    if(!window){
      if(ContextRateGuard.windows.size>=10000)throw new ServiceUnavailableException('Authentication capacity exceeded');
      window={start:now,count:0};ContextRateGuard.windows.set(address,window);
    }
    if(++window.count>120)throw new HttpException('Too many authentication requests. Please retry later.',429);
    return true;
  }
}
