import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const INTEGRATION_REPORT_HEADERS = {
  SUPPORT_TICKETS: ['ticketId','customerId','assignedAdminId','subject','category','status','priority','createdAt','updatedAt'],
  KYC_APPROVALS: ['eventId','userId','actorId','action','previousState','nextState','version','createdAt'],
  MARKETPLACE_ORDERS: ['orderId','customerId','status','currency','grandTotal','paymentVerifiedAt','createdAt'],
  WALLET_TRANSACTIONS: ['entryId','walletId','customerId','currency','type','amount','balanceBefore','balanceAfter','referenceId','createdAt'],
  REFUNDS: ['eventId','referenceId','providerMode','action','actionState','createdAt'],
  NOTIFICATIONS: ['recordId','customerId','source','type','state','attempts','createdAt'],
};
export type IntegrationReportType = keyof typeof INTEGRATION_REPORT_HEADERS;
export const INTEGRATION_REPORT_TITLES: Record<IntegrationReportType,string> = {
  SUPPORT_TICKETS:'Support Tickets',KYC_APPROVALS:'KYC Audit',MARKETPLACE_ORDERS:'Marketplace Orders',WALLET_TRANSACTIONS:'Wallet Transactions',REFUNDS:'Refund Audit Events',NOTIFICATIONS:'Notification Records',
};
export const INTEGRATION_REPORT_DESCRIPTIONS: Record<IntegrationReportType,string> = {
  SUPPORT_TICKETS:'Canonical customer tickets across all clients; private notes and attachment contents are excluded.',
  KYC_APPROVALS:'Recorded astrologer moderation decisions; an approval record is not an independent KYC certification.',
  MARKETPLACE_ORDERS:'Persisted order values by currency; orders and gateway collections are not settled revenue.',
  WALLET_TRANSACTIONS:'One row per canonical wallet journal entry. Currencies and references are retained; no client totals are inferred.',
  REFUNDS:'One row per append-only refund audit event, not one refund total. Workflow success is not provider refund or bank settlement confirmation.',
  NOTIFICATIONS:'Inbox records plus outboxes whose schema gates are enabled. ACCEPTED/SENT means provider acceptance, never confirmed device delivery.',
};
export function isIntegrationReport(type:string): type is IntegrationReportType { return Object.hasOwn(INTEGRATION_REPORT_HEADERS,type); }
export async function integrationReportRows(db:PrismaService,type:IntegrationReportType,where:Record<string,unknown>):Promise<Record<string,unknown>[]> {
  const orderBy={createdAt:'desc' as const};
  switch(type) {
    case 'SUPPORT_TICKETS': return (await db.supportTicket.findMany({where,orderBy,select:{id:true,customerId:true,assignedAdminId:true,subject:true,category:true,status:true,priority:true,createdAt:true,updatedAt:true}})).map(({id,...r})=>({ticketId:id,...r}));
    case 'KYC_APPROVALS':
      if(process.env.ADMIN_MODERATION_SCHEMA_REVIEWED!=='true')throw new ServiceUnavailableException('KYC audit schema is not activated');
      return (await db.adminModerationAudit.findMany({where:{...where,kind:'ASTROLOGER'},orderBy,select:{requestId:true,userId:true,actorId:true,action:true,previousState:true,nextState:true,version:true,createdAt:true}})).map(({requestId,...r})=>({eventId:requestId,...r}));
    case 'MARKETPLACE_ORDERS': return (await db.marketplaceOrder.findMany({where,orderBy,select:{id:true,customerUserId:true,status:true,currency:true,grandTotal:true,paymentVerifiedAt:true,createdAt:true}})).map(({id,customerUserId,...r})=>({orderId:id,customerId:customerUserId,...r}));
    case 'WALLET_TRANSACTIONS': return (await db.walletLedger.findMany({where,orderBy,select:{id:true,walletId:true,userId:true,type:true,amount:true,balanceBefore:true,balanceAfter:true,referenceId:true,createdAt:true,wallet:{select:{currency:true}}}})).map(({id,userId,wallet,...r})=>({entryId:id,customerId:userId,currency:wallet.currency,...r}));
    case 'REFUNDS':
      if(process.env.PAYMENT_CREATION_SCHEMA_READY!=='true')throw new ServiceUnavailableException('Refund audit schema is not activated');
      return (await db.adminFinanceAction.findMany({where:{...where,action:{in:['REFUND_SUBMIT','REFUND_RECONCILE']}},orderBy,select:{id:true,referenceId:true,providerMode:true,action:true,state:true,createdAt:true}})).map(({id,state,...r})=>({eventId:id,actionState:state,...r}));
    case 'NOTIFICATIONS': {
      const rows:Record<string,unknown>[]=(await db.appNotification.findMany({where,orderBy,select:{id:true,userId:true,type:true,isRead:true,createdAt:true}})).map(({id,userId,isRead,...r})=>({recordId:id,customerId:userId,source:'INBOX',state:isRead?'READ':'RECORDED',attempts:'',...r}));
      if(process.env.SUPPORT_OPERATIONS_SCHEMA_READY==='true')for(const r of await db.supportDelivery.findMany({where,orderBy}))rows.push({recordId:r.id,customerId:r.ownerId,source:'SUPPORT_OUTBOX',type:'support_ticket',state:r.state==='SENT'?'ACCEPTED':r.state,attempts:r.attempts,createdAt:r.createdAt});
      if(process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY==='true')for(const r of await db.subscriptionExpiryReminder.findMany({where,orderBy}))rows.push({recordId:r.id,customerId:r.userId,source:'SUBSCRIPTION_OUTBOX',type:'subscription_expiry',state:r.state,attempts:r.attempts,createdAt:r.createdAt});
      return rows.sort((a,b)=>String(a.source).localeCompare(String(b.source))||String(a.recordId).localeCompare(String(b.recordId)));
    }
  }
}
