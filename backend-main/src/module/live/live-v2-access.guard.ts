import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Process-local by design. Distributed activation is forbidden until a shared
// socket adapter and distributed abuse controls have been reviewed.
@Injectable()
export class LiveV2AccessGuard implements CanActivate {
  private readonly logger = new Logger(LiveV2AccessGuard.name);
  private readonly windows = new Map<
    string,
    { expires: number; count: number }
  >();
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    if (
      this.config.get('LIVE_V2_ENABLED') !== 'true' ||
      this.config.get('LIVE_V2_SOCKET_SINGLE_INSTANCE') !== 'true'
    ) {
      throw new ServiceUnavailableException('Live v2 is not enabled');
    }
    const request = context.switchToHttp().getRequest();
    const subject = request.user?.sub;
    if (typeof subject !== 'string' || !subject.trim())
      throw new UnauthorizedException();
    const now = Date.now();
    let window = this.windows.get(subject);
    if (!window || window.expires <= now) {
      if (this.windows.size >= 10000) {
        for (const [key, value] of this.windows)
          if (value.expires <= now) this.windows.delete(key);
        if (this.windows.size >= 10000)
          throw new HttpException(
            'Live request capacity reached. Please wait.',
            429,
          );
      }
      window = { expires: now + 60000, count: 0 };
      this.windows.set(subject, window);
    }
    if (++window.count > 120) {
      if (window.count === 121)
        this.logger.warn({ event: 'live_v2_rate_limited', scope: 'http' });
      throw new HttpException('Too many Live requests. Please wait.', 429);
    }
    return true;
  }
}
