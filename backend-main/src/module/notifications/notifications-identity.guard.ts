import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CommunicationAuthService } from '../../infrastructure/supabase/communication-auth.service';
import { bindAdminRequest } from '../../common/auth/admin-identity-policy';
import { UserService } from '../user/user.service';

/** Revocation-aware canonical verification, without HTTP account sync. */
@Injectable()
export class NotificationsIdentityGuard implements CanActivate {
  constructor(
    private readonly auth: CommunicationAuthService,
    private readonly users: UserService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    const token = header.slice(7).trim();
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
    if (String(identity.asp_account_role).toUpperCase() === 'ADMIN') {
      await bindAdminRequest(request, token, this.users);
    } else request.user = identity;
    return true;
  }
}
