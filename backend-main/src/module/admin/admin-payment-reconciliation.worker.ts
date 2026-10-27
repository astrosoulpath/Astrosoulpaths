import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { configuredPaymentMode, isIsolatedFinancialTestDatabase } from '../payments/payment-creation-command';
import { AdminPaymentOperationsService } from './admin-payment-operations.service';

@Injectable()
export class AdminPaymentReconciliationWorker {
  private running=false;
  private readonly logger=new Logger(AdminPaymentReconciliationWorker.name);
  constructor(private readonly db:PrismaService,private readonly operations:AdminPaymentOperationsService) {}
  @Cron('*/30 * * * * *')
  async tick() {
    const actor=process.env.ADMIN_FINANCE_TEST_ACTOR_ID;
    if(this.running||!actor||process.env.PAYMENT_RECONCILIATION_WORKER_ENABLED!=='true'||
       process.env.PAYMENT_CREATION_SCHEMA_READY!=='true'||process.env.ADMIN_FINANCE_TEST_OPERATIONS_ENABLED!=='true'||configuredPaymentMode()!=='TEST')return;
    this.running=true;
    try {
      if(!await isIsolatedFinancialTestDatabase(this.db))return;
      const jobs=await this.db.$queryRaw<Array<{id:string;attempts:number;lastAttempt:Date|null}>>`
        SELECT p.id,COUNT(a.id)::int AS attempts,MAX(a."createdAt") AS "lastAttempt"
        FROM payment_orders p LEFT JOIN "AdminFinanceAction" a ON a."referenceId"=p.id
          AND a.reason='Scheduled isolated TEST reconciliation' AND a.action='RECONCILE'
        WHERE p.status IN ('PENDING','FAILED') AND p.metadata->>'providerMode'='TEST'
          AND p.type IN ('WALLET_RECHARGE','SUBSCRIPTION')
        GROUP BY p.id,p."createdAt" HAVING COUNT(a.id)<5 ORDER BY p."createdAt",p.id LIMIT 5`;
      for(const job of jobs){
        if(job.lastAttempt&&Date.now()-new Date(job.lastAttempt).getTime()<30000*2**job.attempts)continue;
        // Same order/attempt produces the same action key across worker instances.
        // The durable unique action claim is acquired before provider reconciliation.
        const hex=createHash('sha256').update(JSON.stringify(['test-reconcile',job.id,job.attempts])).digest('hex').slice(0,32);
        const requestKey=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
        try{await this.operations.reconcile(actor,job.id,{requestKey,reason:'Scheduled isolated TEST reconciliation'});}
        catch{this.logger.warn('Test reconciliation not confirmed; durable audit retained.');}
      }
    }finally{this.running=false;}
  }
}
