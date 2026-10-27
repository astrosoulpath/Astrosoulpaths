import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { allocation, refundAllocation, settlementLiability, MarketplaceAmounts, minor } from './marketplace-accounting';

type Entry = { eventKey: string; kind: string; currency: string; productMinor: bigint; discountMinor: bigint; shippingMinor: bigint; taxMinor: bigint; feeMinor: bigint; sellerMinor: bigint; platformMinor: bigint };
// Not exposed as an HTTP endpoint. Provider orchestration must supply verified
// evidence and approved per-seller component allocations before activation.
@Injectable()
export class MarketplaceJournalService {
  constructor(private readonly prisma: PrismaService) {}
  async append(sellerOrderId: string, eventKey: string, kind: 'CAPTURE'|'REFUND'|'SETTLEMENT', amounts: MarketplaceAmounts) {
    if (!sellerOrderId || !/^[a-zA-Z0-9_:-]{10,200}$/.test(eventKey)) throw new ConflictException('Invalid journal identity');
    return this.prisma.$transaction(tx => this.appendInTransaction(tx, sellerOrderId, eventKey, kind, amounts), {isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  // The caller must own a Serializable transaction. This permits fulfillment or
  // refund reconciliation and its journal entry to commit or roll back together.
  async appendInTransaction(tx: Prisma.TransactionClient, sellerOrderId: string, eventKey: string, kind: 'CAPTURE'|'REFUND'|'SETTLEMENT', amounts: MarketplaceAmounts) {
    if (!sellerOrderId || !/^[a-zA-Z0-9_:-]{10,200}$/.test(eventKey)) throw new ConflictException('Invalid journal identity');
      // Lock the persisted suborder, not a process-local mutex. No automatic retry.
      const owners = await tx.$queryRaw<{id:string}[]>`SELECT id FROM "MarketplaceSellerOrder" WHERE id=${sellerOrderId} FOR UPDATE`;
      if (owners.length !== 1) throw new ConflictException('Unknown marketplace suborder');
      const entries = await tx.$queryRaw<Entry[]>`SELECT "eventKey",kind,currency,"productMinor","discountMinor","shippingMinor","taxMinor","feeMinor","sellerMinor","platformMinor" FROM "MarketplaceFinancialEntry" WHERE "sellerOrderId"=${sellerOrderId}`;
      const base = allocation(amounts);
      if (base.gross === 0n) throw new ConflictException('Zero-value financial posting is not allowed');
      const capture = entries.find(e=>e.kind==='CAPTURE');
      const sum = (kind:string,key:keyof Entry) => entries.filter(e=>e.kind===kind).reduce((n,e)=>n+BigInt(e[key]),0n);
      const same = entries.find(e=>e.eventKey===eventKey);
      if(same && kind!=='CAPTURE') {
        const matches = same.kind===kind && same.currency===amounts.currency && !amounts.discountMinor && !amounts.feeMinor &&
          (kind==='REFUND' ? same.productMinor===minor(amounts.productMinor) && same.shippingMinor===minor(amounts.shippingMinor) && same.taxMinor===minor(amounts.taxMinor) : same.sellerMinor===minor(amounts.productMinor) && !amounts.shippingMinor && !amounts.taxMinor);
        if(!matches) throw new ConflictException('Journal idempotency payload mismatch');
        return {alreadyRecorded:true};
      }
      let row: Omit<Entry,'eventKey'|'kind'|'currency'>;
      if (kind==='CAPTURE') {
        row={productMinor:base.commissionable,discountMinor:base.discount,shippingMinor:base.shipping,taxMinor:base.tax,feeMinor:base.fee,sellerMinor:base.seller,platformMinor:base.platform};
        if(capture && !same) throw new ConflictException('Capture already journaled');
      } else {
        if(!capture || capture.currency!==amounts.currency) throw new ConflictException('Verified capture snapshot required');
        if(kind==='REFUND') {
          // Discount already belongs to the capture; refund input is net product.
          if(amounts.discountMinor || amounts.feeMinor) throw new ConflictException('Refund fee/discount policy is not approved');
          const original:MarketplaceAmounts={currency:capture.currency,productMinor:Number(capture.productMinor),discountMinor:0,shippingMinor:Number(capture.shippingMinor),taxMinor:Number(capture.taxMinor),feeMinor:0};
          const previous={product:Number(sum('REFUND','productMinor')-(same?.productMinor??0n)),shipping:Number(sum('REFUND','shippingMinor')-(same?.shippingMinor??0n)),tax:Number(sum('REFUND','taxMinor')-(same?.taxMinor??0n))};
          const r=refundAllocation(original,previous,{product:amounts.productMinor,shipping:amounts.shippingMinor,tax:amounts.taxMinor});
          row={productMinor:r.product,discountMinor:0n,shippingMinor:r.shipping,taxMinor:r.tax,feeMinor:0n,sellerMinor:r.seller,platformMinor:r.platform};
        } else {
          // Settlement amount uses productMinor only as internal input. It is never
          // treated as another sale or a provider transfer confirmation.
          if(amounts.discountMinor||amounts.shippingMinor||amounts.taxMinor||amounts.feeMinor) throw new ConflictException('Invalid settlement components');
          const available=settlementLiability(capture.sellerMinor,sum('REFUND','sellerMinor'),sum('SETTLEMENT','sellerMinor')-(same?.sellerMinor??0n));
          if(minor(amounts.productMinor)>available.payable) throw new ConflictException('Settlement exceeds payable liability');
          row={productMinor:0n,discountMinor:0n,shippingMinor:0n,taxMinor:0n,feeMinor:0n,sellerMinor:minor(amounts.productMinor),platformMinor:0n};
        }
      }
      if(same){
        if(same.kind!==kind || same.currency!==amounts.currency || Object.entries(row).some(([k,v])=>same[k]!==v)) throw new ConflictException('Journal idempotency payload mismatch');
        return {alreadyRecorded:true};
      }
      const id=randomUUID();
      await tx.$executeRaw`INSERT INTO "MarketplaceFinancialEntry" (id,"sellerOrderId","eventKey",kind,currency,"productMinor","discountMinor","shippingMinor","taxMinor","feeMinor","sellerMinor","platformMinor") VALUES (${id},${sellerOrderId},${eventKey},${kind},${amounts.currency},${row.productMinor},${row.discountMinor},${row.shippingMinor},${row.taxMinor},${row.feeMinor},${row.sellerMinor},${row.platformMinor})`;
      return {alreadyRecorded:false};
  }
}
