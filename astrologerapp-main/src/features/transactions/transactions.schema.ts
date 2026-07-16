import { z } from "zod";

export const transactionFilterSchema = z.enum([
  "all",
  "earnings",
  "payouts",
]);

export const transactionTypeSchema = z.enum([
  "earning",
  "payout",
]);

export const transactionStatusSchema = z.enum([
  "completed",
  "successful",
  "pending",
  "failed",
]);

export const transactionRecordSchema = z.object({
  amount: z.number().nonnegative(),
  id: z.string().min(1),
  occurredAt: z.string().min(1),
  status: transactionStatusSchema,
  title: z.string().min(1),
  type: transactionTypeSchema,
});

export const transactionSnapshotSchema = z.object({
  availableBalance: z.number().nonnegative(),
  pendingBalance: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),

  todayEarnings: z.number().nonnegative(),
  weekEarnings: z.number().nonnegative(),
  monthEarnings: z.number().nonnegative(),
  lifetimeEarnings: z.number().nonnegative(),

  totalTransactions: z.number().int().nonnegative(),

  transactions: z.array(transactionRecordSchema),
});

export type TransactionFilter = z.infer<
  typeof transactionFilterSchema
>;

export type TransactionRecord = z.infer<
  typeof transactionRecordSchema
>;

export type TransactionSnapshot = z.infer<
  typeof transactionSnapshotSchema
>;

export const transactionFilters: {
  label: string;
  value: TransactionFilter;
}[] = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Earnings",
    value: "earnings",
  },
  {
    label: "Payouts",
    value: "payouts",
  },
];