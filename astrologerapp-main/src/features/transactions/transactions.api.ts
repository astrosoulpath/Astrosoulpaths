import {
  apiClient,
  getApiErrorMessage,
} from "@/src/lib/api-client";

import {
  TransactionFilter,
  TransactionSnapshot,
  transactionSnapshotSchema,
} from "@/src/features/transactions/transactions.schema";

type EarningsSummaryResponse = {
  success: boolean;
  data: {
    astrologerId: string;
    currency: string;
    availableBalance: number;
    pendingBalance: number;
    paidAmount: number;
    todayEarnings: number;
    weekEarnings: number;
    monthEarnings: number;
    lifetimeEarnings: number;
    totalTransactions: number;
  };
};

type BackendEarningStatus =
  | "PENDING"
  | "AVAILABLE"
  | "PAID"
  | "REVERSED";

type EarningsTransaction = {
  id: string;
  callSessionId: string;
  type: "earning";
  title: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: BackendEarningStatus;
  availableAt: string | null;
  paidAt: string | null;
  reversedAt: string | null;
  createdAt: string;
  consultation: {
    id: string;
    customerId: string;
    customerName: string;
    customerAvatarUrl: string | null;
    channelName: string;
    ratePerMinute: number;
    purchasedMinutes: number;
    extendedMinutes: number;
    amountCharged: number;
    startedAt: string;
    endedAt: string | null;
    status: string;
  };
};

type EarningsTransactionsResponse = {
  success: boolean;
  data: {
    transactions: EarningsTransaction[];
    total: number;
  };
};

function mapBackendStatus(
  status: BackendEarningStatus,
): "completed" | "successful" | "pending" | "failed" {
  switch (status) {
    case "AVAILABLE":
      return "completed";

    case "PAID":
      return "successful";

    case "PENDING":
      return "pending";

    case "REVERSED":
      return "failed";

    default:
      return "pending";
  }
}

export async function fetchTransactionSnapshot(): Promise<TransactionSnapshot> {
  try {
    const [
      summaryResponse,
      transactionsResponse,
    ] = await Promise.all([
      apiClient.get<EarningsSummaryResponse>(
        "/astrologer/earnings/summary",
      ),

      apiClient.get<EarningsTransactionsResponse>(
        "/astrologer/earnings/transactions",
      ),
    ]);

    const summary =
      summaryResponse.data.data;

    const earnings =
      transactionsResponse.data.data.transactions;

    return transactionSnapshotSchema.parse({
      availableBalance: Number(
  summary.availableBalance ?? 0,
),

   pendingBalance: Number(
  summary.pendingBalance ?? 0,
),

   paidAmount: Number(
   summary.paidAmount ?? 0,
),

  todayEarnings: Number(
  summary.todayEarnings ?? 0,
),

weekEarnings: Number(
  summary.weekEarnings ?? 0,
),

  monthEarnings: Number(
  summary.monthEarnings ?? 0,
),

  lifetimeEarnings: Number(
  summary.lifetimeEarnings ?? 0,
),

  totalTransactions: Number(
  summary.totalTransactions ?? 0,
),

  transactions:
        earnings.map(
          (earning) => ({
            id:
              earning.id,

            title:
              earning.title ||
              "Consultation Earnings",

            type:
              "earning" as const,

            amount:
              Number(
                earning.netAmount ??
                  0,
              ),

            status:
              mapBackendStatus(
                earning.status,
              ),

            occurredAt:
              earning.availableAt ||
              earning.createdAt,
          }),
        ),
    });
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error),
    );
  }
}

export function filterTransactions(
  snapshot: TransactionSnapshot,
  filter: TransactionFilter,
) {
  if (filter === "all") {
    return snapshot.transactions;
  }

  const targetType =
    filter === "earnings"
      ? "earning"
      : "payout";

  return snapshot.transactions.filter(
    (transaction) =>
      transaction.type ===
      targetType,
  );
}