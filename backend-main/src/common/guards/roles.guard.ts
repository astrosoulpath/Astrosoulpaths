import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — authenticated access is sufficient
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException('User identity missing from request');
    }

    // Look up user by supabaseId (JWT sub = Supabase user ID)
    const dbUser = await this.prisma.user.findUnique({
      where: { supabaseId: user.sub },
      select: {
        isActive: true,
        isBlocked: true,
        role: { select: { name: true } },
      },
    });

    if (!dbUser) {
      throw new ForbiddenException('User not found');
    }

    if (dbUser.isBlocked) {
      throw new ForbiddenException('Account is blocked');
    }

    if (!dbUser.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    const hasRole = requiredRoles.includes(dbUser.role.name);

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
