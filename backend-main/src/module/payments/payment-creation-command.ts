import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export function paymentCreationEnabled() {
  if(process.env.PAYMENT_CREATION_COMMANDS_ENABLED==='true'&&process.env.PAYMENT_CREATION_SCHEMA_READY!=='true')
    throw new ServiceUnavailableException('Payment creation schema must be verified before enabling durable commands');
  return process.env.PAYMENT_CREATION_SCHEMA_READY === 'true' &&
    process.env.PAYMENT_CREATION_COMMANDS_ENABLED === 'true';
}
export function configuredPaymentMode(): 'TEST'|'LIVE'|'UNKNOWN' {
  const key = process.env.RAZORPAY_KEY_ID?.trim() ?? '';
  return /^rzp_test_[A-Za-z0-9]+$/.test(key) ? 'TEST' :
    /^rzp_live_[A-Za-z0-9]+$/.test(key) ? 'LIVE' : 'UNKNOWN';
}
export type CreationClaim = {id:string; state:string; providerOrderId:string|null; amountMinor:bigint; currency:string};
export async function isIsolatedFinancialTestDatabase(db:Pick<PrismaService,'$queryRaw'>) {
  const rows=await db.$queryRaw<Array<{name:string;port:number}>>`SELECT current_database() AS name,inet_server_port() AS port`;
  return rows.length===1&&rows[0].port===16432&&/^asp_payment_operations_[a-f0-9]{12}$/.test(rows[0].name);
}
export class PaymentCreationCommands {
  constructor(private readonly db: PrismaService) {}
  async reserve(input: {userId:string; purpose:string; reference:string; amountMinor:number; currency:string}) {
    const mode = configuredPaymentMode();
    if (!paymentCreationEnabled() || mode === 'UNKNOWN') throw new ServiceUnavailableException('Durable payment creation is not activated');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || !/^[A-Z]{3}$/.test(input.currency))
      throw new ConflictException('Invalid authoritative payment quote');
    const scope = createHash('sha256').update(JSON.stringify([input.userId, input.purpose, input.reference, mode])).digest('hex');
    const quote = createHash('sha256').update(JSON.stringify([input.amountMinor, input.currency])).digest('hex');
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
      const old = await tx.$queryRaw<Array<CreationClaim & {quoteHash:string}>>`
        SELECT * FROM "PaymentCreationCommand" WHERE "scopeKey"=${scope} AND state<>'COMPLETE' FOR UPDATE`;
      if (old.length) {
        const row = old[0];
        if (row.quoteHash !== quote) throw new ConflictException('An outstanding order has a different quote; reconcile it before another purchase');
        if (row.state !== 'READY' || !row.providerOrderId) throw new ConflictException('Payment creation is pending or uncertain; reconcile without resubmission');
        return { ...row, reused: true };
      }
      const id = randomUUID();
      const rows = await tx.$queryRaw<CreationClaim[]>`INSERT INTO "PaymentCreationCommand"
        (id,"userId","scopeKey","quoteHash","providerMode","amountMinor",currency,state,"updatedAt")
        VALUES (${id},${input.userId},${scope},${quote},${mode},${BigInt(input.amountMinor)},${input.currency},'SUBMITTING',CURRENT_TIMESTAMP)
        RETURNING *`;
      return { ...rows[0], reused: false };
    });
  }
  async unknown(id:string) {
    await this.db.$executeRaw`UPDATE "PaymentCreationCommand" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id} AND state='SUBMITTING'`;
  }
  async bind(tx: Prisma.TransactionClient, id:string, providerOrderId:string) {
    const changed = await tx.$executeRaw`UPDATE "PaymentCreationCommand" SET state='READY',"providerOrderId"=${providerOrderId},"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id} AND state='SUBMITTING' AND "providerOrderId" IS NULL`;
    if (changed !== 1) throw new ConflictException('Payment creation binding changed; reconcile without resubmission');
  }
}
