import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type CustomerFilter = 'ALL' | 'ACTIVE' | 'BLOCKED' | 'WITH_WALLET' | 'WITHOUT_WALLET';
export function customerWhere(search?: string, status?: string): Prisma.UserWhereInput {
  const term = search?.trim();
  if (term && term.length > 200) throw new BadRequestException('Search is too long');
  if (status && !['ALL', 'ACTIVE', 'BLOCKED', 'WITH_WALLET', 'WITHOUT_WALLET'].includes(status)) {
    throw new BadRequestException('Invalid customer status filter');
  }
  const filters: Prisma.UserWhereInput[] = [{ role: { name: { equals: 'CUSTOMER', mode: 'insensitive' } } }];
  if (term) filters.push({ OR: [
    { id: { equals: term } }, { email: { contains: term, mode: 'insensitive' } },
    { phone: { contains: term } }, { name: { contains: term, mode: 'insensitive' } },
    { userProfile: { fullName: { contains: term, mode: 'insensitive' } } },
  ] });
  if (status === 'ACTIVE') filters.push({ isActive: true, isBlocked: false });
  if (status === 'BLOCKED') filters.push({ OR: [{ isActive: false }, { isBlocked: true }] });
  if (status === 'WITH_WALLET') filters.push({ wallet: { isNot: null } });
  if (status === 'WITHOUT_WALLET') filters.push({ wallet: { is: null } });
  return { AND: filters };
}
