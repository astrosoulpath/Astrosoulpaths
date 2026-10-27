import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MarketplaceJournalService } from './marketplace-journal.service';
import { allocation, MarketplaceAmounts } from './marketplace-accounting';

type Allocation = MarketplaceAmounts & { sellerOrderId: string };
export function refundComponents(snapshot: unknown, amount: bigint, currency: string): Allocation[] {
  const value = snapshot as { version?: unknown; allocations?: unknown } | null;
  if (value?.version !== 1 || !Array.isArray(value.allocations) || !value.allocations.length || value.allocations.length > 100) {
    throw new ConflictException('Approved refund component snapshot required');
  }
  const seen = new Set<string>();
  let total = 0n;
  const rows = value.allocations.map((raw: unknown) => {
    const row = raw as Allocation | null;
    if (!row || typeof row.sellerOrderId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.sellerOrderId) || seen.has(row.sellerOrderId) || row.currency !== currency || row.discountMinor !== 0 || row.feeMinor !== 0) {
      throw new ConflictException('Refund component ownership or policy mismatch');
    }
    seen.add(row.sellerOrderId);
    const amounts: Allocation = { sellerOrderId: row.sellerOrderId, currency: row.currency, productMinor: row.productMinor, discountMinor: 0, shippingMinor: row.shippingMinor, taxMinor: row.taxMinor, feeMinor: 0 };
    const result = allocation(amounts);
    if (!result.gross) throw new ConflictException('Empty refund component');
    total += result.gross;
    return amounts;
  });
  if (amount <= 0n || total !== amount) throw new ConflictException('Refund component total mismatch');
  return rows.sort((a, b) => a.sellerOrderId.localeCompare(b.sellerOrderId));
}

// No HTTP route, scheduler, provider sender or DI activation. This consumes only
// an already provider-confirmed immutable intent; approval alone is insufficient.
export class MarketplaceRefundJournal {
  constructor(private readonly prisma: PrismaService, private readonly journal: MarketplaceJournalService) {}
  async postConfirmed(attemptId: string) {
    if (process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED !== 'true') throw new ServiceUnavailableException('Marketplace refund workflow is not activated');
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ state: string; amountMinor: bigint; currency: string; componentSnapshot: unknown; orderId: string }[]>`
        SELECT a.state, a."amountMinor", a.currency, a."componentSnapshot", c."orderId"
        FROM "MarketplaceRefundAttempt" a
        JOIN "MarketplaceOrderCase" c ON c.id=a."caseId"
        JOIN "MarketplaceOrder" o ON o.id=c."orderId"
        WHERE a.id=${attemptId} AND c.kind='REFUND' AND c.status='APPROVED'
          AND c."customerUserId"=o."customerUserId" AND a."providerPaymentId"=o."razorpayPaymentId"
          AND o."paymentVerifiedAt" IS NOT NULL AND a."providerRefundId" IS NOT NULL
        FOR UPDATE OF a`;
      const attempt = rows[0];
      if (rows.length !== 1 || attempt.state !== 'PROVIDER_CONFIRMED') throw new ConflictException('Confirmed refund ownership required');
      const components = refundComponents(attempt.componentSnapshot, attempt.amountMinor, attempt.currency);
      for (const component of components) {
        const owner = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "MarketplaceSellerOrder" WHERE id=${component.sellerOrderId} AND "orderId"=${attempt.orderId} FOR UPDATE`;
        if (owner.length !== 1) throw new ConflictException('Refund suborder ownership mismatch');
        await this.journal.appendInTransaction(tx, component.sellerOrderId, `refund:${attemptId}:${component.sellerOrderId}`, 'REFUND', component);
      }
      return { financialJournalPosted: true, suborders: components.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
