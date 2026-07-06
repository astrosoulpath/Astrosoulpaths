import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JWTPayload } from 'jose';

/**
 * Extracts the verified JWT payload attached by SupabaseAuthGuard.
 *
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: JWTPayload) {
 *   return user.sub; // Supabase user ID
 * }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JWTPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
