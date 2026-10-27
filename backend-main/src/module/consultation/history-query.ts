import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Filters are combined with, never substituted for, the authenticated owner. */
export function historyWhere(params: { search?: string; status?: string; mode?: string }, audience: 'customer' | 'admin'): Prisma.CallSessionWhereInput {
  for (const value of [params.search, params.status, params.mode]) {
    if (value !== undefined && typeof value !== 'string') throw new BadRequestException('Invalid history filters');
  }
  const search = params.search?.trim() ?? '';
  const status = params.status?.trim().toUpperCase() ?? '';
  const mode = params.mode?.trim().toLowerCase() ?? '';
  if (search.length > 100 || (mode && !['chat', 'audio', 'video'].includes(mode)) ||
      (status && !['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'ENDED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(status))) {
    throw new BadRequestException('Invalid history filters');
  }
  const participants: Prisma.CallSessionWhereInput[] = [
    { astrologer: { name: { contains: search, mode: 'insensitive' } } },
    { astrologer: { userProfile: { fullName: { contains: search, mode: 'insensitive' } } } },
  ];
  if (audience === 'admin') participants.push(
    { user: { name: { contains: search, mode: 'insensitive' } } },
    { user: { userProfile: { fullName: { contains: search, mode: 'insensitive' } } } },
    { user: { email: { contains: search, mode: 'insensitive' } } },
    { user: { phone: { contains: search, mode: 'insensitive' } } },
    { astrologer: { email: { contains: search, mode: 'insensitive' } } },
    { astrologer: { phone: { contains: search, mode: 'insensitive' } } },
    { channelName: { contains: search, mode: 'insensitive' } },
    { userId: { contains: search, mode: 'insensitive' } },
    { astrologerId: { contains: search, mode: 'insensitive' } },
  );
  return {
    ...(search ? { OR: [{ id: { contains: search, mode: 'insensitive' } }, ...participants] } : {}),
    ...(mode ? { mode: { equals: mode, mode: 'insensitive' } } : {}),
    ...(status && status !== 'ALL' ? { status: { in: audience === 'customer' && status === 'CANCELLED' ? ['CANCELLED', 'REJECTED', 'EXPIRED'] : audience === 'admin' && status === 'EXPIRED' ? ['EXPIRED', 'ENDED'] : audience === 'admin' && status === 'ACTIVE' ? ['ACTIVE', 'ONGOING'] : [status], mode: 'insensitive' } } : {}),
  };
}
