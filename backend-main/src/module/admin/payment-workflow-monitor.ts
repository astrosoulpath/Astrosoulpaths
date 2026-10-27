import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export async function paymentWorkflowMonitor(prisma: PrismaService) {
  if (process.env.PAYMENT_INTEGRITY_SCHEMA_READY !== 'true') {
    return {schemaReady:false,refunds:[],exceptions:[],workflowEnabled:false};
  }
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const refunds=await tx.$queryRaw`SELECT state,currency,count(*)::int AS count,sum("amountMinor")::text AS "amountMinor" FROM "MarketplaceRefundAttempt" GROUP BY state,currency ORDER BY state,currency`;
    const exceptions=await tx.$queryRaw`SELECT status,currency,count(*)::int AS count FROM marketplace_payment_exceptions GROUP BY status,currency ORDER BY status,currency`;
    return {schemaReady:true,refunds,exceptions,workflowEnabled:process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED==='true'};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
