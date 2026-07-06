import { useQuery } from "@tanstack/react-query";

import { fetchTransactionSnapshot } from "@/src/features/transactions/transactions.api";

const transactionSnapshotKey = ["transaction-snapshot"];

export function useTransactionSnapshotQuery() {
  return useQuery({
    queryFn: fetchTransactionSnapshot,
    queryKey: transactionSnapshotKey,
  });
}
