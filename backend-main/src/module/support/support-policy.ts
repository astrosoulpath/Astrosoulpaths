import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  SupportTicketStatus,
  SupportTicketPriority,
} from '@prisma/client';
import { auditSupport } from './support-operations';

export async function resolveSupportActor(db: any, auth: any, admin = false) {
  const subject = typeof auth?.sub === 'string' ? auth.sub.trim() : '';
  if (!subject)
    throw new UnauthorizedException('Canonical authentication required');
  const users = await db.user.findMany({
    where: {
      OR: [
        { supabaseId: subject },
        {
          authIdentities: {
            some: { provider: 'supabase', providerUserId: subject },
          },
        },
      ],
    },
    include: { role: true, astrologer: true },
    take: 2,
  });
  const user = users[0];
  if (
    users.length !== 1 ||
    !user.isActive ||
    user.isBlocked ||
    (auth.asp_user_id && auth.asp_user_id !== user.id)
  )
    throw new UnauthorizedException('Active canonical account required');
  const role = user.role?.name?.toUpperCase();
  if (
    admin
      ? role !== 'ADMIN'
      : !['CUSTOMER', 'USER', 'ASTROLOGER'].includes(role) && !(role==='ADMIN'&&auth.asp_user_id===user.id&&
        (auth.asp_context==='customer'||(auth.asp_context==='astrologer'&&auth.asp_account_role==='ASTROLOGER'&&user.isAstrologer&&user.astrologer?.isApproved&&user.astrologer?.isVerified)))
  )
    throw new ForbiddenException('Support role is not authorized');
  if (role === 'ASTROLOGER' && !user.astrologer?.isApproved && auth.asp_context!=='customer')
    throw new ForbiddenException('Approved astrologer required');
  return user;
}

export function supportPage(
  input: {
    page?: unknown;
    limit?: unknown;
    search?: unknown;
    status?: unknown;
    priority?: unknown;
  } = {},
) {
  const page = input.page === undefined ? 1 : Number(input.page);
  const limit = input.limit === undefined ? 25 : Number(input.limit);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new BadRequestException('Invalid pagination');
  if (
    input.search != null &&
    (typeof input.search !== 'string' || input.search.length > 160)
  )
    throw new BadRequestException('Invalid search');
  if (
    input.status &&
    !Object.values(SupportTicketStatus).includes(input.status as any)
  )
    throw new BadRequestException('Invalid ticket status');
  if (
    input.priority &&
    !Object.values(SupportTicketPriority).includes(input.priority as any)
  )
    throw new BadRequestException('Invalid ticket priority');
  return { page, limit, search: String(input.search ?? '').trim() };
}

export function supportText(value: unknown, max: number, min = 1) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new BadRequestException('Invalid support text');
  return value.trim();
}

// Account-level and ticket-level locks serialize retries across app instances.
export async function supportLock(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1196377166, hashtext(${key}))::text AS lock_result`;
}

export async function supportDuplicate(
  tx: Prisma.TransactionClient,
  sender: string,
  ticket: string,
  key?: string | null,
) {
  if (!key) return null;
  const duplicate = await tx.supportMessage.findFirst({
    where: { senderUserId: sender, clientMessageId: key },
  });
  if (duplicate && duplicate.ticketId !== ticket)
    throw new BadRequestException('Message key belongs to another ticket');
  return duplicate;
}

export async function changeSupportTicket(
  db: any,
  actorId: string,
  ticketId: string,
  action: string,
  patch: (ticket: any) => any,
  after?: (
    tx: Prisma.TransactionClient,
    current: any,
    updated: any,
  ) => Promise<void>,
) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await supportLock(tx, 'ticket:' + ticketId);
    const current = await tx.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!current) throw new BadRequestException('Support ticket not found');
    const data = patch(current);
    if (Object.keys(data).every((key) => data[key] === current[key]))
      return current;
    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data,
    });
    if (after) await after(tx, current, updated);
    await auditSupport(
      tx,
      actorId,
      'TICKET',
      ticketId,
      action,
      {
        before: {
          status: current.status,
          priority: current.priority,
          assignedAdminId: current.assignedAdminId,
        },
        after: {
          status: updated.status,
          priority: updated.priority,
          assignedAdminId: updated.assignedAdminId,
        },
      },
      current.customerId,
    );
    return updated;
  });
}
