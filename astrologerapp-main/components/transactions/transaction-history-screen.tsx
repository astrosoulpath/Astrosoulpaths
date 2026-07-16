import {
  format,
  isValid,
  parseISO,
} from "date-fns";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react-native";
import {
  useMemo,
  useState,
} from "react";
import {
  Alert,
  StyleSheet,
} from "react-native";

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

function groupTransactionsByMonth(
  transactions: TransactionRecord[],
) {
  const grouped =
    new Map<
      string,
      TransactionRecord[]
    >();

  for (const transaction of transactions) {
    const parsedDate =
      parseISO(
        transaction.occurredAt,
      );

    const label =
      isValid(parsedDate)
        ? format(
            parsedDate,
            "MMMM yyyy",
          )
        : "Other";

    const existing =
      grouped.get(label) ?? [];

    existing.push(transaction);
    grouped.set(label, existing);
  }

  return Array.from(
    grouped.entries(),
  ).map(
    ([title, data]) => ({
      data,
      title,
    }),
  );
}

export function TransactionHistoryScreen() {
  const router =
    useRouter();

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<TransactionFilter>(
      "all",
    );

  const transactionQuery =
    useTransactionSnapshotQuery();

  const filteredTransactions =
    useMemo(() => {
      if (!transactionQuery.data) {
        return [];
      }

      return filterTransactions(
        transactionQuery.data,
        activeFilter,
      );
    }, [
      activeFilter,
      transactionQuery.data,
    ]);

  const sections =
    useMemo(
      () =>
        groupTransactionsByMonth(
          filteredTransactions,
        ),
      [filteredTransactions],
    );

  const summary =
    transactionQuery.data;

  return (
    <AppContainer>
      <Box
        pointerEvents="none"
        style={styles.overlay}
      />

      <VStack className="flex-1 gap-4 px-1">
        <HStack className="min-h-12 items-center justify-between">
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            onPress={() =>
              router.back()
            }
          >
            <ArrowLeft
              color={astroColors.white}
              size={28}
              strokeWidth={2.2}
            />
          </Pressable>

          <Text
            style={{
              color:
                astroColors.white,
              fontFamily:
                "PlayfairDisplay_600SemiBold",
              fontSize: 22,
              lineHeight: 28,
            }}
          >
            Earnings & Transactions
          </Text>

          <Pressable
            accessibilityLabel="Refresh earnings"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            disabled={
              transactionQuery.isFetching
            }
            onPress={() => {
              void transactionQuery.refetch();
            }}
          >
            <RefreshCw
              color={astroColors.gold}
              size={23}
              strokeWidth={2.2}
            />
          </Pressable>
        </HStack>

        {transactionQuery.error ? (
          <Box className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3">
            <Text
              style={{
                color: "#FFB4B4",
                fontFamily:
                  "Inter_500Medium",
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {transactionQuery.error instanceof
              Error
                ? transactionQuery.error
                    .message
                : "Unable to load earnings."}
            </Text>
          </Box>
        ) : null}

        <BalanceSummaryCard
          availableBalance={
            summary?.availableBalance ??
            0
          }
          pendingBalance={
            summary?.pendingBalance ??
            0
          }
          paidAmount={
            summary?.paidAmount ??
            0
          }
          todayEarnings={
            summary?.todayEarnings ??
            0
          }
          weekEarnings={
            summary?.weekEarnings ??
            0
          }
          monthEarnings={
            summary?.monthEarnings ??
            0
          }
          lifetimeEarnings={
            summary?.lifetimeEarnings ??
            0
          }
          totalTransactions={
            summary?.totalTransactions ??
            0
          }
          onPayoutPress={() =>
            Alert.alert(
              "Payout request",
              "Payout requests will be enabled after bank details and admin approval flow are connected.",
            )
          }
        />

        <HStack className="items-center justify-between">
          <Text
            style={{
              color:
                astroColors.white,
              fontFamily:
                "Inter_600SemiBold",
              fontSize: 16,
              lineHeight: 21,
            }}
          >
            Transaction History
          </Text>

          <Pressable
            accessibilityLabel="Advanced transaction filters"
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center"
            onPress={() =>
              Alert.alert(
                "Advanced filters",
                "Date range and earning-status filters will be connected in the next payout phase.",
              )
            }
          >
            <SlidersHorizontal
              color={astroColors.gold}
              size={21}
              strokeWidth={2.2}
            />
          </Pressable>
        </HStack>

        <TransactionFilterTabs
          activeFilter={activeFilter}
          onChange={
            setActiveFilter
          }
        />

        <Box className="min-h-64 flex-1">
          <TransactionHistoryList
            isLoading={
              transactionQuery.isLoading
            }
            sections={sections}
          />
        </Box>
      </VStack>
    </AppContainer>
  );
}

const styles =
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        "rgba(2, 8, 23, 0.42)",
    },
  });