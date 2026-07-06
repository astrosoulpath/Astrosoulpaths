import { format, parseISO } from "date-fns";
import { useRouter } from "expo-router";
import { ArrowLeft, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, StyleSheet } from "react-native";

import { BalanceSummaryCard } from "@/components/transactions/balance-summary-card";
import { TransactionFilterTabs } from "@/components/transactions/transaction-filter-tabs";
import { TransactionHistoryList } from "@/components/transactions/transaction-history-list";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";
import { filterTransactions } from "@/src/features/transactions/transactions.api";
import {
  TransactionFilter,
  TransactionRecord,
} from "@/src/features/transactions/transactions.schema";
import { useTransactionSnapshotQuery } from "@/src/features/transactions/use-transactions";

function groupTransactionsByMonth(transactions: TransactionRecord[]) {
  const grouped = new Map<string, TransactionRecord[]>();

  for (const transaction of transactions) {
    const label = format(parseISO(transaction.occurredAt), "MMMM yyyy");
    const existing = grouped.get(label) ?? [];
    existing.push(transaction);
    grouped.set(label, existing);
  }

  return Array.from(grouped.entries()).map(([title, data]) => ({
    data,
    title,
  }));
}

export function TransactionHistoryScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>("all");
  const transactionQuery = useTransactionSnapshotQuery();

  const filteredTransactions = useMemo(() => {
    if (!transactionQuery.data) {
      return [];
    }

    return filterTransactions(transactionQuery.data, activeFilter);
  }, [activeFilter, transactionQuery.data]);

  const sections = useMemo(
    () => groupTransactionsByMonth(filteredTransactions),
    [filteredTransactions],
  );

  return (
    <AppContainer>
      <Box pointerEvents="none" style={styles.overlay} />

      <VStack className="flex-1 gap-4 px-1">
        <HStack className="min-h-12 items-center justify-between">
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            onPress={() => router.back()}
          >
            <ArrowLeft color={astroColors.white} size={28} strokeWidth={2.2} />
          </Pressable>

          <Text
            style={{
              color: astroColors.white,
              fontFamily: "PlayfairDisplay_600SemiBold",
              fontSize: 22,
              lineHeight: 28,
            }}
          >
            Light Transaction
          </Text>

          <Pressable
            accessibilityLabel="Filter transactions"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            onPress={() =>
              Alert.alert(
                "Filters",
                "Add advanced date and status filters here when your backend is ready.",
              )
            }
          >
            <SlidersHorizontal
              color={astroColors.gold}
              size={24}
              strokeWidth={2.2}
            />
          </Pressable>
        </HStack>

        <BalanceSummaryCard
          availableBalance={transactionQuery.data?.availableBalance ?? 0}
          onPayoutPress={() =>
            Alert.alert(
              "Payout",
              "Connect your payout request flow to Supabase or your backend here.",
            )
          }
        />

        <TransactionFilterTabs
          activeFilter={activeFilter}
          onChange={setActiveFilter}
        />

        <Box className="flex-1">
          <TransactionHistoryList
            isLoading={transactionQuery.isLoading}
            sections={sections}
          />
        </Box>
      </VStack>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 8, 23, 0.42)",
  },
});
