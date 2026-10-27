import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** No route/worker; explicit designated isolated TEST operator only. */
export class WalletTestRefund {
  constructor(private readonly db:PrismaService,private readonly provider:any,private readonly customerId:string) {}
  private async guard(){
    if(process.env.WALLET_TEST_REFUND_ENABLED!=='true'||!/^rzp_test_[A-Za-z0-9]+$/.test(process.env.RAZORPAY_KEY_ID||'')||!this.customerId)
      throw new ServiceUnavailableException('Designated TEST refund not enabled');
    const [s]=await this.db.$queryRaw<Array<{name:string;port:number}>>`SELECT current_database() AS name,inet_server_port() AS port`;
    if(s?.port!==16432||!/^asp_payment_operations_[a-f0-9]{12}$/.test(s.name)||s.name!==process.env.WALLET_TEST_REFUND_DATABASE)
      throw new ServiceUnavailableException('Exact isolated database required');
  }
  private async event(tx:any,id:string,action:string){await tx.$executeRaw`INSERT INTO "WalletTestRefundEvent"(id,"refundId",action) VALUES(${randomUUID()},${id},${action})`}
  async prepare(orderId:string){
    await this.guard();const id='wtr_'+createHash('sha256').update(orderId).digest('hex').slice(0,32);
    return this.db.$transaction(async tx=>{
      const order=await tx.paymentOrder.findUnique({where:{id:orderId}});
      if(!order||order.userId!==this.customerId||order.type!=='WALLET_RECHARGE'||order.status!=='SUCCESS'||(order.metadata as any)?.providerMode!=='TEST'||order.amount.toString()!=='100'||order.currency!=='INR'||!order.walletId||!order.razorpayPaymentId)
        throw new ConflictException('Designated captured INR100 wallet order required');
      await tx.$queryRaw`SELECT id FROM wallets WHERE id=${order.walletId} FOR UPDATE`;
      const old=await tx.$queryRaw<any[]>`SELECT id FROM "WalletTestRefund" WHERE "paymentOrderId"=${order.id}`;
      if(old.length)return old[0].id;
      const wallet=await tx.wallet.findUnique({where:{id:order.walletId}});
      const ledger=await tx.walletLedger.findMany({where:{walletId:order.walletId}});
      if(!wallet||wallet.userId!==this.customerId||wallet.currency!=='INR'||wallet.balance.toString()!=='100'||wallet.paidBalance.toString()!=='100'||wallet.freeBalance.toString()!=='0'||wallet.lockedBalance.toString()!=='0'||
         ledger.length!==1||ledger[0].type!=='RECHARGE'||ledger[0].referenceId!==order.id||ledger[0].amount.toString()!=='100')
        throw new ConflictException('Entire unspent paid principal with no bonus or other transactions required');
      await tx.$executeRaw`INSERT INTO "WalletTestRefund"(id,"paymentOrderId","walletId","userId","providerPaymentId","amountMinor",currency,state) VALUES(${id},${order.id},${wallet.id},${this.customerId},${order.razorpayPaymentId},10000,'INR','HELD')`;
      await tx.wallet.update({where:{id:wallet.id},data:{lockedBalance:{increment:100}}});
      await this.event(tx,id,'APPROVED_UNSPENT_PRINCIPAL_HELD');return id;
    });
  }
  async submit(id:string){
    await this.guard();const [r]=await this.db.$queryRaw<any[]>`SELECT r.*,p."razorpayOrderId" FROM "WalletTestRefund" r JOIN payment_orders p ON p.id=r."paymentOrderId" WHERE r.id=${id} AND r."userId"=${this.customerId}`;
    if(!r||r.state!=='HELD')throw new ConflictException('Claimed refunds must never be resubmitted');
    const p=await this.provider.payments.fetch(r.providerPaymentId),refunds=await this.provider.payments.fetchMultipleRefund(r.providerPaymentId,{count:100});
    if(p.status!=='captured'||p.captured!==true||p.order_id!==r.razorpayOrderId||p.amount!==10000||p.amount_refunded!==0||p.currency!=='INR'||refunds.items?.length!==0)throw new ConflictException('Unrefunded captured TEST payment required');
    const claimed=await this.db.$transaction(async tx=>{const n=await tx.$executeRaw`UPDATE "WalletTestRefund" SET state='SUBMITTING',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='HELD'`;if(n)await this.event(tx,id,'PROVIDER_SUBMIT_CLAIMED');return n});
    if(!claimed)throw new ConflictException('Already claimed');
    try{
      const proof=await this.provider.payments.refund(r.providerPaymentId,{amount:10000,speed:'normal',receipt:id,notes:{purpose:'approved_unspent_wallet_test'}});
      if(!/^rfnd_[A-Za-z0-9]+$/.test(proof.id))throw Error('Invalid provider reference');
      await this.db.$transaction(async tx=>{await tx.$executeRaw`UPDATE "WalletTestRefund" SET state='PENDING',"providerRefundId"=${proof.id},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='SUBMITTING'`;await this.event(tx,id,'PROVIDER_REFERENCE_RECORDED')});
    }catch{await this.db.$executeRaw`UPDATE "WalletTestRefund" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='SUBMITTING'`;throw new ServiceUnavailableException('Outcome uncertain; hold retained, reconcile without resubmission')}
    return this.reconcile(id);
  }
  async reconcile(id:string){
    await this.guard();const [r]=await this.db.$queryRaw<any[]>`SELECT * FROM "WalletTestRefund" WHERE id=${id} AND "userId"=${this.customerId}`;
    if(!r)throw new ConflictException('Unknown designated refund');if(r.state==='PROCESSED')return {state:'PROCESSED',alreadyProcessed:true};
    if(!['SUBMITTING','UNKNOWN','PENDING'].includes(r.state))throw new ConflictException('Refund not submitted');
    let ref=r.providerRefundId;
    if(!ref){const all=await this.provider.payments.fetchMultipleRefund(r.providerPaymentId,{count:100});const found=all.items.filter((x:any)=>x.receipt===id&&x.payment_id===r.providerPaymentId&&x.amount===10000&&x.currency==='INR');
      if(found.length!==1)throw new ConflictException('Uncertain outcome: preserve hold; never resubmit');ref=found[0].id;
      if(r.state==='SUBMITTING')await this.db.$executeRaw`UPDATE "WalletTestRefund" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='SUBMITTING'`;
      await this.db.$executeRaw`UPDATE "WalletTestRefund" SET state='PENDING',"providerRefundId"=${ref},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='UNKNOWN'`;
    }
    const proof=await this.provider.refunds.fetch(ref);
    if(proof.id!==ref||proof.payment_id!==r.providerPaymentId||proof.receipt!==id||proof.amount!==10000||proof.currency!=='INR'||!['processed','pending','failed'].includes(proof.status))throw new ConflictException('Provider proof mismatch; hold retained');
    if(proof.status==='pending')return {state:'PENDING',alreadyProcessed:false};
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "WalletTestRefund" WHERE id=${id} FOR UPDATE`;
      const [current]=await tx.$queryRaw<any[]>`SELECT state FROM "WalletTestRefund" WHERE id=${id}`;
      if(current.state==='PROCESSED')return {state:'PROCESSED',alreadyProcessed:true};
      if(!['PENDING','UNKNOWN'].includes(current.state))throw new ConflictException('Invalid refund transition');
      await tx.$queryRaw`SELECT id FROM wallets WHERE id=${r.walletId} FOR UPDATE`;
      const w=await tx.wallet.findUnique({where:{id:r.walletId}}),p=await tx.paymentOrder.findUnique({where:{id:r.paymentOrderId}});
      if(!w||w.userId!==this.customerId||w.balance.toString()!=='100'||w.paidBalance.toString()!=='100'||w.freeBalance.toString()!=='0'||w.lockedBalance.toString()!=='100'||p?.status!=='SUCCESS')throw new ConflictException('Reserved wallet drift; preserve hold and reconcile manually');
      if(proof.status==='failed'){
        await tx.wallet.update({where:{id:w.id},data:{lockedBalance:{decrement:100}}});
        await tx.$executeRaw`UPDATE "WalletTestRefund" SET state='FAILED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}`;await this.event(tx,id,'PROVIDER_FAILED_HOLD_RELEASED_NO_DEBIT');return {state:'FAILED',alreadyProcessed:false};
      }
      await tx.wallet.update({where:{id:w.id},data:{balance:{decrement:100},paidBalance:{decrement:100},lockedBalance:{decrement:100}}});
      await tx.$executeRaw`INSERT INTO wallet_ledger(id,"walletId","userId",type,amount,"balanceBefore","balanceAfter","referenceId","referenceType",description)
        VALUES(${randomUUID()},${w.id},${this.customerId},'RECHARGE_REFUND',100,100,0,${id},'REFUND','Approved full TEST recharge refund — unspent principal')`;
      await tx.paymentOrder.update({where:{id:r.paymentOrderId},data:{status:'REFUNDED'}});
      await tx.$executeRaw`UPDATE "WalletTestRefund" SET state='PROCESSED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}`;
      await this.event(tx,id,'PROVIDER_PROCESSED_SINGLE_WALLET_DEBIT');return {state:'PROCESSED',alreadyProcessed:false};
    });
  }
}
