import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { checkoutSnapshot } from './marketplace-checkout-snapshot';
import { MarketplaceQuote } from './marketplace-quote';
import { MarketplaceJournalService } from './marketplace-journal.service';
import { allocation } from './marketplace-accounting';

export function checkoutDigest(value:unknown):string {
  const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(key=>[key,stable(v[key])])):v;
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export class MarketplaceCheckoutStore {
  constructor(private readonly prisma: PrismaService) {}
  private enabled() {
    if(process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED!=='true') throw new ServiceUnavailableException('Verified marketplace checkout snapshots are not activated');
  }
  // Internal adapter boundary only, never a client DTO. Prices are loaded from
  // the persisted order, and each quote must come from a verified server adapter.
  async persist(orderId:string, customerUserId:string, quotes:Map<string,MarketplaceQuote>) {
    this.enabled();
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "MarketplaceOrder" WHERE id=${orderId} FOR UPDATE`;
      const order=await tx.marketplaceOrder.findFirst({where:{id:orderId,customerUserId},include:{sellerOrders:{include:{items:true}}}});
      if(!order || order.status!=='PENDING_PAYMENT' || order.razorpayOrderId || order.currency!=='INR' || !order.sellerOrders.length || order.sellerOrders.length>100 || quotes.size!==order.sellerOrders.length) throw new ConflictException('Owned unbound INR checkout required');
      const snapshots=order.sellerOrders.map(seller=>{
        const quote=quotes.get(seller.id);
        if(!quote || quote.destinationPostalCode!==order.postalCode || quote.destinationCountry!==order.countryCode) throw new ConflictException('Verified destination-bound quote required');
        const items=seller.items.map(item=>{
          const price=item.unitPrice.mul(100);
          if(!item.productId || item.currency!=='INR' || !price.isInteger()) throw new ConflictException('Invalid persisted product price');
          return {productId:item.productId,quantity:item.quantity,unitPriceMinor:price.toNumber()};
        });
        return JSON.parse(checkoutSnapshot({orderId,customerUserId,sellerOrderId:seller.id,items,quote}).canonical);
      }).sort((a,b)=>a.sellerOrderId.localeCompare(b.sellerOrderId));
      const amount=snapshots.reduce((sum,s)=>sum+BigInt(s.totalMinor),0n);
      if(amount!==BigInt(order.grandTotal.mul(100).toFixed(0))) throw new ConflictException('Authoritative checkout total mismatch');
      const canonical=JSON.stringify(snapshots), hash=checkoutDigest(snapshots);
      const expiresAt=new Date(Math.min(...snapshots.map(s=>s.evidence.expiresAt)));
      const previous=await tx.$queryRaw<{sha256:string}[]>`SELECT "sha256" FROM "MarketplaceCheckoutSnapshot" WHERE "orderId"=${orderId}`;
      if(previous.length){if(previous[0].sha256!==hash) throw new ConflictException('Checkout snapshot replay mismatch');return {alreadyPersisted:true};}
      await tx.$executeRaw`INSERT INTO "MarketplaceCheckoutSnapshot" ("orderId","customerUserId",currency,"amountMinor","expiresAt",payload,"sha256") VALUES (${orderId},${customerUserId},'INR',${amount},${expiresAt},${canonical}::jsonb,${hash})`;
      return {alreadyPersisted:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async requireFresh(orderId:string,customerUserId:string,amount:number,currency:string) {
    this.enabled();
    const rows=await this.prisma.$queryRaw<{amountMinor:bigint;currency:string;expiresAt:Date}[]>`SELECT "amountMinor",currency,"expiresAt" FROM "MarketplaceCheckoutSnapshot" WHERE "orderId"=${orderId} AND "customerUserId"=${customerUserId}`;
    if(rows.length!==1 || rows[0].amountMinor!==BigInt(amount) || rows[0].currency!==currency || rows[0].expiresAt.getTime()<=Date.now()) throw new ConflictException('Fresh authoritative checkout snapshot required');
  }
  async claimProviderCreation(orderId:string) {
    this.enabled();
    const rows=await this.prisma.$queryRaw<{orderId:string}[]>`INSERT INTO "MarketplacePaymentCommand" ("orderId") SELECT s."orderId" FROM "MarketplaceCheckoutSnapshot" s JOIN "MarketplaceOrder" o ON o.id=s."orderId" WHERE s."orderId"=${orderId} AND s."expiresAt">now() AND o.status='PENDING_PAYMENT' AND o."razorpayOrderId" IS NULL ON CONFLICT DO NOTHING RETURNING "orderId"`;
    if(rows.length!==1) throw new ConflictException('Payment creation already claimed; reconcile without resubmission');
  }
  async bindProviderOrder(orderId:string,providerOrderId:string) {
    const count=await this.prisma.$executeRaw`UPDATE "MarketplacePaymentCommand" SET state='READY',"providerOrderId"=${providerOrderId} WHERE "orderId"=${orderId} AND state IN ('CREATING','UNKNOWN')`;
    if(count!==1) {
      const rows=await this.prisma.$queryRaw<{providerOrderId:string}[]>`SELECT "providerOrderId" FROM "MarketplacePaymentCommand" WHERE "orderId"=${orderId} AND state='READY'`;
      if(rows.length!==1 || rows[0].providerOrderId!==providerOrderId) throw new ConflictException('Payment creation binding requires reconciliation');
    }
  }
  // Invoked only after verified capture inside the existing Serializable
  // fulfillment transaction. Delayed capture honors the frozen purchased quote.
  async postCapture(tx:Prisma.TransactionClient,orderId:string,paymentId:string,amount:number,currency:string) {
    if(process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED!=='true') return;
    const rows=await tx.$queryRaw<{payload:unknown;sha256:string;amountMinor:bigint;currency:string}[]>`
      SELECT s.payload,s."sha256",s."amountMinor",s.currency FROM "MarketplaceCheckoutSnapshot" s
      JOIN "MarketplaceOrder" o ON o.id=s."orderId" AND o."customerUserId"=s."customerUserId"
      WHERE s."orderId"=${orderId} AND o."razorpayPaymentId"=${paymentId} AND o."paymentVerifiedAt" IS NOT NULL FOR UPDATE OF o`;
    const record=rows[0];
    if(rows.length!==1 || record.amountMinor!==BigInt(amount) || record.currency!==currency || !Array.isArray(record.payload) || checkoutDigest(record.payload)!==record.sha256) throw new ConflictException('Captured checkout snapshot mismatch');
    const journal=new MarketplaceJournalService(this.prisma);
    const sellers=await tx.marketplaceSellerOrder.findMany({where:{orderId},select:{id:true}});
    const ids=new Set(sellers.map(s=>s.id)); let total=0n;
    for(const snapshot of record.payload as any[]) {
      if(snapshot.orderId!==orderId || !ids.delete(snapshot.sellerOrderId) || snapshot.amounts?.currency!==currency) throw new ConflictException('Captured seller snapshot mismatch');
      total+=allocation(snapshot.amounts).gross;
      await journal.appendInTransaction(tx,snapshot.sellerOrderId,`capture:${paymentId}:${snapshot.sellerOrderId}`,'CAPTURE',snapshot.amounts);
    }
    if(ids.size || total!==record.amountMinor) throw new ConflictException('Captured component total mismatch');
  }
  async reconcileCaptured(orderId:string) {
    if(process.env.MARKETPLACE_CHECKOUT_SNAPSHOT_ENABLED!=='true') return;
    return this.prisma.$transaction(async tx=>{
      const order=await tx.marketplaceOrder.findUnique({where:{id:orderId}});
      if(!order?.paymentVerifiedAt || !order.razorpayPaymentId || !order.razorpayAmountSubunits || !order.paymentCurrency) throw new ConflictException('Persisted verified capture required');
      await this.postCapture(tx,orderId,order.razorpayPaymentId,order.razorpayAmountSubunits.toNumber(),order.paymentCurrency);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
