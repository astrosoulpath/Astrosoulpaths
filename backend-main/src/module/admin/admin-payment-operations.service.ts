import { Injectable, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { configuredPaymentMode, isIsolatedFinancialTestDatabase } from '../payments/payment-creation-command';

@Injectable()
export class AdminPaymentOperationsService {
  constructor(private readonly db:PrismaService, private readonly payments:PaymentsService) {}
  private reference(id:string) {
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new BadRequestException('Invalid payment reference');
  }
  async detail(id:string) {
    this.reference(id);
    const row = await this.db.paymentOrder.findUnique({where:{id},select:{
      id:true,amount:true,currency:true,type:true,status:true,razorpayOrderId:true,razorpayPaymentId:true,
      metadata:true,createdAt:true,updatedAt:true,
    }});
    if(!row) throw new NotFoundException('Payment order not found');
    const metadata=row.metadata as Record<string,unknown>|null;
    const mode=['TEST','LIVE'].includes(String(metadata?.providerMode))?String(metadata?.providerMode):'UNKNOWN';
    const schema=process.env.PAYMENT_CREATION_SCHEMA_READY==='true';
    const audit=schema?await this.db.$queryRaw`SELECT id,action,state,reason,result,"createdAt" FROM "AdminFinanceAction"
      WHERE "referenceId"=${id} ORDER BY "createdAt" DESC,id DESC LIMIT 50`:[];
    const isolated=schema&&await isIsolatedFinancialTestDatabase(this.db);
    return {success:true,data:{...row,metadata:undefined,providerMode:mode,audit,
      canReconcile:isolated&&mode==='TEST'&&configuredPaymentMode()==='TEST'&&process.env.ADMIN_FINANCE_TEST_OPERATIONS_ENABLED==='true',
      refundExecution:{enabled:false,reason:'Refund requires an approved allocation intent and registered provider dispatcher; reconciliation does not issue refunds.'},
      settlement:{status:'UNVERIFIED',reason:'Capture is not evidence of a bank settlement.'},
    }};
  }
  async reconcile(actorUserId:string,id:string,body:{reason?:unknown;requestKey?:unknown}) {
    this.reference(id);
    if(typeof body.reason!=='string'||body.reason.trim().length<10||body.reason.trim().length>500||
       typeof body.requestKey!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestKey))
      throw new BadRequestException('Provide a reason (10–500 characters) and unique request key');
    const detail=await this.detail(id);
    if(!detail.data.canReconcile) throw new ServiceUnavailableException('Verified TEST payment, operational schema and explicit test-operation gate are required');
    const actor=await this.db.user.findUnique({where:{id:actorUserId},include:{role:true}});
    if(!actor?.isActive||actor.isBlocked||actor.role?.name!=='ADMIN') throw new ConflictException('Active canonical Admin required');
    const requestKey=body.requestKey;
    const created=await this.db.$queryRaw<Array<{id:string}>>`INSERT INTO "AdminFinanceAction"
      (id,"actorUserId",action,"referenceId","providerMode",reason,"requestKey",state,"updatedAt")
      VALUES (${randomUUID()},${actorUserId},'RECONCILE',${id},'TEST',${body.reason.trim()},${requestKey},'STARTED',CURRENT_TIMESTAMP)
      ON CONFLICT ("requestKey") DO NOTHING RETURNING id`;
    if(!created.length) throw new ConflictException('This action was already submitted; reload its audit history');
    try {
      const result=await this.payments.reconcileTestPaymentForAdmin(id);
      await this.db.$executeRaw`UPDATE "AdminFinanceAction" SET state='SUCCEEDED',result=${JSON.stringify(result)}::jsonb,"updatedAt"=CURRENT_TIMESTAMP
        WHERE "requestKey"=${requestKey} AND state='STARTED'`;
      return {success:true,data:result};
    } catch {
      await this.db.$executeRaw`UPDATE "AdminFinanceAction" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP
        WHERE "requestKey"=${requestKey} AND state='STARTED'`;
      throw new ServiceUnavailableException('Reconciliation outcome unavailable; inspect audit and retry with a new request only after review');
    }
  }
}
