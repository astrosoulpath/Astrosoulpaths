import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CommunicationAuthService } from '../../../infrastructure/supabase/communication-auth.service';
import type { JWTPayload } from 'jose';

/** Read-only canonical lookup: never calls HTTP legacy sync/provision fallback. */
@Injectable()
export class ConsultationKundliAuthGuard implements CanActivate {
  constructor(private readonly auth: CommunicationAuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      method?: string;
      route?: { path?: string };
      path?: string;
      user?: JWTPayload;
    }>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    const token = header.slice(7).trim();
    // This sensitive route never accepts local development bypass credentials.
    if (!token || token.startsWith('local-'))
      throw new UnauthorizedException('Authentication required');
    const identity = await this.auth.verify(token);
    if (
      !identity.asp_user_id ||
      !identity.sub ||
      !identity.exp ||
      identity.exp <= Date.now() / 1000
    )
      throw new UnauthorizedException('Canonical authentication required');
    // A signed portal context must not inherit another portal's capabilities
    // merely because both contexts resolve to the same canonical account.
    if (identity.asp_context) {
      const method = String(request.method || 'GET').toUpperCase();
      const route = String(request.route?.path || request.path || '');
      const required =
        method === 'POST' && route.endsWith('/generate')
          ? ['astrologer']
          : method === 'POST' || method === 'DELETE'
            ? ['customer']
            : ['customer', 'astrologer'];
      if (
        typeof identity.asp_context !== 'string' ||
        !required.includes(identity.asp_context)
      )
        throw new ForbiddenException(
          'This account context cannot perform this Kundli operation',
        );
    }
    request.user = identity;
    return true;
  }
}
