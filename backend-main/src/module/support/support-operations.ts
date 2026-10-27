import { ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export function supportOperationsEnabled() {
  return (
    process.env.SUPPORT_OPERATIONS_SCHEMA_READY === 'true' &&
    process.env.SUPPORT_OPERATIONS_ENABLED === 'true'
  );
}
export function requireSupportOperations() {
  if (!supportOperationsEnabled())
    throw new ServiceUnavailableException(
      'Support operations await migration and release approval',
    );
}
/** Called inside the same transaction as the business change; no provider calls. */
export async function auditSupport(
  tx: Prisma.TransactionClient,
  actorId: string,
  objectType: string,
  objectId: string,
  action: string,
  details: Record<string, unknown> = {},
  ownerId?: string,
  eventKey?: string,
) {
  if (!supportOperationsEnabled()) return;
  await tx.$executeRaw`INSERT INTO public."SupportOperationAudit" ("id","actorId","objectType","objectId","action","details") VALUES (${randomUUID()},${actorId},${objectType},${objectId},${action},${JSON.stringify(details)}::jsonb)`;
  if (ownerId && objectType === 'TICKET')
    await tx.$executeRaw`INSERT INTO public."SupportDelivery" ("id","ticketId","ownerId","eventKey","event") VALUES (${randomUUID()},${objectId},${ownerId},${eventKey ?? randomUUID()},${action}) ON CONFLICT ("eventKey") DO NOTHING`;
}
