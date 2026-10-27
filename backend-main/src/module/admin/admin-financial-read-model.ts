import { Prisma } from '@prisma/client';
export async function financialReadModel(tx:Prisma.TransactionClient) {
  const collectionsByMode=await tx.$queryRaw`SELECT
    CASE WHEN metadata->>'providerMode' IN ('TEST','LIVE') THEN metadata->>'providerMode' ELSE 'UNKNOWN' END AS "providerMode",
    currency,status,type,COUNT(*)::int AS count,SUM(amount)::text AS amount
    FROM payment_orders GROUP BY 1,currency,status,type ORDER BY 1,currency,status,type`;
  const walletDiagnostics=await tx.$queryRaw`SELECT currency,COUNT(*)::int AS "walletCount",
    COUNT(*) FILTER (WHERE balance<>"paidBalance"+"freeBalance")::int AS "bucketDivergenceCount",
    SUM(balance-"paidBalance"-"freeBalance")::text AS "bucketDifference",
    COUNT(*) FILTER (WHERE "lockedBalance">balance OR balance<0)::int AS "reservationAnomalyCount"
    FROM wallets GROUP BY currency ORDER BY currency`;
  return {collectionsByMode,walletDiagnostics,
    totalScope:'GLOBAL_RECORDED_ROWS',
    walletBasis:'balance is the recorded total; lockedBalance is reserved within it. Available balance is max(0,balance-lockedBalance). Paid/free buckets are separate stored projections; divergence requires ledger investigation, not an automatic correction.',
  };
}
