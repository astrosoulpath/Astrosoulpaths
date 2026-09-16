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

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (isPublic) {
      return true;
    }


    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );


    // Route does not require role
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }


    const request =
      context.switchToHttp().getRequest();


    const user = request.user;


    if (!user?.sub) {
      throw new UnauthorizedException(
        'User identity missing from request',
      );
    }


    /*
     * Canonical account resolution
     * ----------------------------
     * A customer may authenticate using multiple Supabase identities
     * (for example Phone OTP + Google).
     *
     * UserAuthIdentity is authoritative.
     * User.supabaseId is retained only as a legacy fallback.
     */
    const authIdentity =
      await this.prisma.userAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'supabase',
            providerUserId: user.sub,
          },
        },
        select: {
          userId: true,
        },
      });

    const dbUser = authIdentity
      ? await this.prisma.user.findUnique({
          where: {
            id: authIdentity.userId,
          },
          select: {
            isActive: true,
            isBlocked: true,
            roleId: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : await this.prisma.user.findUnique({
          where: {
            supabaseId: user.sub,
          },
          select: {
            isActive: true,
            isBlocked: true,
            roleId: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });


    if (!dbUser) {
      throw new ForbiddenException(
        'User not found',
      );
    }


    if (dbUser.isBlocked) {
      throw new ForbiddenException(
        'Account is blocked',
      );
    }


    if (!dbUser.isActive) {
      throw new ForbiddenException(
        'Account is inactive',
      );
    }


    const userRoles = [
      dbUser.roleId,
      dbUser.role?.id,
      dbUser.role?.name,
    ]
      .filter(Boolean)
      .map((role) =>
        String(role).toUpperCase(),
      );


    const allowedRoles =
      requiredRoles.map((role) =>
        role.toUpperCase(),
      );


    const hasRole =
      allowedRoles.some((role) =>
        userRoles.includes(role),
      );


    if (!hasRole) {
      throw new ForbiddenException(
        'Insufficient permissions',
      );
    }


    return true;
  }
}
