import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  validateCommissionPercent,
} from './commission-policy';

// Both are OFF by default. Activation requires approved schema and charging policy.
export function commissionAuditEnabled(): boolean {
  return process.env.FINANCIAL_SCHEMA_READY === 'true';
}
export function financialLifecycleEnabled(): boolean {
  return (
    process.env.FINANCIAL_LIFECYCLE_V2_ENABLED === 'true' &&
    process.env.FINANCIAL_SCHEMA_READY === 'true'
  );
}

export function approvedReleaseAt(completedAt: Date): Date {
  const value = process.env.FINANCIAL_APPROVED_HOLD_SECONDS;
  if (!value || !/^\d+$/.test(value))
    throw new ConflictException('Approved earnings release policy is required');
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds > 31536000)
    throw new ConflictException('Invalid earnings release policy');
  return new Date(completedAt.getTime() + seconds * 1000);
}

export async function lockCommissionPolicy(tx: Prisma.TransactionClient) {
  // Same transaction lock for creation and Admin policy writes, including absent default row.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1095979057, 1129270605)::text AS lock_result`;
}

export async function snapshotCommission(
  tx: Prisma.TransactionClient,
  callSessionId: string,
) {
  await lockCommissionPolicy(tx);
  // Approved future human consultations are fixed at 70/30. Existing
  // snapshots and Admin settings are preserved, never rewritten here.
  const percent = 30;
  validateCommissionPercent(percent);
  const version = createHash('sha256')
    .update('HUMAN_CONSULTATION_70_30_V1')
    .digest('hex');
  await tx.$executeRaw`INSERT INTO public."ConsultationFinancialPolicy"
    ("callSessionId", "platformPercent", "policyVersion", "lockedAt", "lifecycle")
    VALUES (${callSessionId}, ${new Prisma.Decimal(percent)}, ${version}, CURRENT_TIMESTAMP, 'CONSULTATION_V2')`;
}

export async function readFinancialPolicy(
  tx: Prisma.TransactionClient,
  id: string,
) {
  if (!financialLifecycleEnabled()) return null;
  const rows = await tx.$queryRaw<
    Array<{ platformPercent: Prisma.Decimal; lifecycle: string }>
  >`
    SELECT "platformPercent", "lifecycle" FROM public."ConsultationFinancialPolicy" WHERE "callSessionId" = ${id}`;
  if (!rows.length) return null; // Historical record: no inferred origin or backfill.
  if (rows.length !== 1 || rows[0].lifecycle !== 'CONSULTATION_V2')
    throw new ConflictException('Invalid financial lifecycle');
  validateCommissionPercent(Number(rows[0].platformPercent));
  return rows[0];
}
