import {
  supabaseTransactionRowSchema,
  TransactionFilter,
  TransactionSnapshot,
  transactionSnapshotSchema,
  type SupabaseTransactionRow,
} from "@/src/features/transactions/transactions.schema";
import { getSupabaseClient } from "@/src/lib/supabase/client";

const mockTransactionSnapshot: TransactionSnapshot = {
  availableBalance: 12450,
  transactions: [
    {
      amount: 1250,
      id: "txn-2024-05-20-1030",
      occurredAt: "2024-05-20T10:30:00.000Z",
      status: "completed",
      title: "Consultation Earnings",
      type: "earning",
    },
    {
      amount: 5000,
      id: "txn-2024-05-18-1615",
      occurredAt: "2024-05-18T16:15:00.000Z",
      status: "successful",
      title: "Payout to Bank",
      type: "payout",
    },
    {
      amount: 750,
      id: "txn-2024-05-17-0945",
      occurredAt: "2024-05-17T09:45:00.000Z",
      status: "completed",
      title: "Consultation Earnings",
      type: "earning",
    },
    {
      amount: 2300,
      id: "txn-2024-05-15-1120",
      occurredAt: "2024-05-15T11:20:00.000Z",
      status: "completed",
      title: "Consultation Earnings",
      type: "earning",
    },
    {
      amount: 3000,
      id: "txn-2024-05-10-1410",
      occurredAt: "2024-05-10T14:10:00.000Z",
      status: "successful",
      title: "Payout to Bank",
      type: "payout",
    },
    {
      amount: 1100,
      id: "txn-2024-05-08-1840",
      occurredAt: "2024-05-08T18:40:00.000Z",
      status: "completed",
      title: "Consultation Earnings",
      type: "earning",
    },
    {
      amount: 500,
      id: "txn-2024-05-05-1200",
      occurredAt: "2024-05-05T12:00:00.000Z",
      status: "completed",
      title: "Bonus Received",
      type: "earning",
    },
    {
      amount: 2500,
      id: "txn-2024-04-28-1525",
      occurredAt: "2024-04-28T15:25:00.000Z",
      status: "successful",
      title: "Payout to Bank",
      type: "payout",
    },
    {
      amount: 1800,
      id: "txn-2024-04-25-1015",
      occurredAt: "2024-04-25T10:15:00.000Z",
      status: "completed",
      title: "Consultation Earnings",
      type: "earning",
    },
    {
      amount: 950,
      id: "txn-2024-04-20-2030",
      occurredAt: "2024-04-20T20:30:00.000Z",
      status: "completed",
      title: "Consultation Earnings",
      type: "earning",
    },
    {
      amount: 4000,
      id: "txn-2024-04-15-1340",
      occurredAt: "2024-04-15T13:40:00.000Z",
      status: "successful",
      title: "Payout to Bank",
      type: "payout",
    },
  ],
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAvailableBalanceFromSupabase() {
  const client = getSupabaseClient();

  if (!client) {
    return undefined;
  }

  const summaryTable =
    process.env.EXPO_PUBLIC_SUPABASE_WALLET_SUMMARY_TABLE ?? "wallet_summary";

  const { data, error } = await client
    .from(summaryTable)
    .select("available_balance")
    .limit(1)
    .maybeSingle();

  if (error || !data?.available_balance) {
    return undefined;
  }

  return Number(data.available_balance);
}

export async function fetchTransactionSnapshot() {
  const client = getSupabaseClient();

  if (!client) {
    await wait(180);
    return mockTransactionSnapshot;
  }

  try {
    const transactionsTable =
      process.env.EXPO_PUBLIC_SUPABASE_TRANSACTIONS_TABLE ??
      "wallet_transactions";

    const [{ data, error }, availableBalance] = await Promise.all([
      client
        .from(transactionsTable)
        .select("id, title, type, amount, occurred_at, status")
        .order("occurred_at", { ascending: false }),
      fetchAvailableBalanceFromSupabase(),
    ]);

    if (error) {
      throw error;
    }

    const parsedRows = (data ?? []).map((row: unknown) =>
      supabaseTransactionRowSchema.parse(row),
    );

    return transactionSnapshotSchema.parse({
      availableBalance:
        availableBalance ?? mockTransactionSnapshot.availableBalance,
      transactions: parsedRows.map((row: SupabaseTransactionRow) => ({
        amount: row.amount,
        id: row.id,
        occurredAt: row.occurred_at,
        status: row.status,
        title: row.title,
        type: row.type,
      })),
    });
  } catch (error) {
    console.warn("Falling back to mock transaction data", error);
    await wait(180);
    return mockTransactionSnapshot;
  }
}

export function filterTransactions(
  snapshot: TransactionSnapshot,
  filter: TransactionFilter,
) {
  if (filter === "all") {
    return snapshot.transactions;
  }

  const targetType = filter === "earnings" ? "earning" : "payout";

  return snapshot.transactions.filter(
    (transaction) => transaction.type === targetType,
  );
}
