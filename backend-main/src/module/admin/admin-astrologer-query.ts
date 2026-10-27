import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function astrologerWhere(params: {search?: string; approval?: string; onlineOnly?: boolean}): Prisma.AstrologerWhereInput {
  if (params.search !== undefined && typeof params.search !== 'string') throw new BadRequestException('Invalid search');
  const search = params.search?.trim() ?? '';
  if (search.length > 100 || (params.approval && !['ALL', 'PENDING', 'APPROVED'].includes(params.approval))) throw new BadRequestException('Invalid astrologer filters');
  return {
    ...(params.approval === 'PENDING' ? {isApproved: false} : {}),
    ...(params.approval === 'APPROVED' ? {isApproved: true} : {}),
    ...(params.onlineOnly ? {isOnline: true} : {}),
    ...(search ? {OR: [
      {id: {contains: search, mode: 'insensitive'}},
      {userId: {contains: search, mode: 'insensitive'}},
      {user: {name: {contains: search, mode: 'insensitive'}}},
      {user: {email: {contains: search, mode: 'insensitive'}}},
      {user: {phone: {contains: search, mode: 'insensitive'}}},
      {user: {userProfile: {fullName: {contains: search, mode: 'insensitive'}}}},
      {languages: {has: search}},
      {expertise: {some: {expertise: {name: {contains: search, mode: 'insensitive'}}}}},
    ]} : {}),
  };
}
