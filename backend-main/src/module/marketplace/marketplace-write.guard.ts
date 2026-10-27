import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

@Injectable()
export class MarketplaceWriteGuard implements CanActivate {
  private readonly buckets = new Map<string, { start: number; count: number }>();
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (['GET','HEAD','OPTIONS'].includes(request.method)) return true;
    const subject = request.user?.sub;
    if (typeof subject !== 'string' || !subject) throw new HttpException('Authentication required',401);
    const now = Date.now();
    for (const [key, bucket] of this.buckets) if (now - bucket.start >= 60000) this.buckets.delete(key);
    const bucket = this.buckets.get(subject) ?? { start: now, count: 0 };
    if (!this.buckets.has(subject) && this.buckets.size >= 10000) throw new HttpException('Marketplace temporarily busy',429);
    if (++bucket.count > 60) throw new HttpException('Too many marketplace changes. Try again shortly.',429);
    this.buckets.set(subject,bucket);
    return true;
  }
}
