import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';

/** Bounded per-instance HTTP abuse protection. Delivery deduplication is global in PostgreSQL. */
@Injectable()
export class SubscriptionExpiryRateGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { until: number; count: number }
  >();
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { asp_user_id?: string }; method: string }>();
    const owner = request.user?.asp_user_id;
    if (!owner || owner.length > 256)
      throw new ForbiddenException('Canonical account required');
    const read = request.method === 'GET',
      limit = read ? 60 : 10;
    const key = owner + (read ? ':read' : ':write'),
      now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) {
      if (this.buckets.size >= 10_000) {
        for (const [id, value] of this.buckets)
          if (value.until <= now) this.buckets.delete(id);
        if (this.buckets.size >= 10_000 && !this.buckets.has(key))
          throw new HttpException(
            'Reminder service is busy. Please retry.',
            429,
          );
      }
      bucket = { until: now + 60_000, count: 0 };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= limit)
      throw new HttpException(
        'Too many reminder requests. Please retry in a minute.',
        429,
      );
    bucket.count++;
    return true;
  }
}
