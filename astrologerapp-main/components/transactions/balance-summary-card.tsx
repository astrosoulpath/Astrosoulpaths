import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Landmark,
  Upload,
  Wallet,
} from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { astroColors } from "@/src/constants/colors";

type BalanceSummaryCardProps = {
  availableBalance: number;
  pendingBalance: number;
  paidAmount: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  lifetimeEarnings: number;
  totalTransactions: number;
  onPayoutPress?: () => void;
};

function formatCurrency(amount: number) {
  const safeAmount =
    Number.isFinite(amount)
      ? amount
      : 0;

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(safeAmount);
}

type SummaryItemProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

function SummaryItem({
  label,
  value,
  icon,
}: SummaryItemProps) {
  return (
    <Box className="w-[48%] rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Box className="mb-3 h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
        {icon}
      </Box>

      <Text
        style={{
          color: astroColors.white,
          fontFamily: "Inter_700Bold",
          fontSize: 18,
          lineHeight: 24,
        }}
      >
        {value}
      </Text>

      <Text
        style={{
          color: astroColors.muted,
          fontFamily: "Inter_400Regular",
          fontSize: 12,
          lineHeight: 17,
          marginTop: 3,
        }}
      >
        {label}
      </Text>
    </Box>
  );
}

export function BalanceSummaryCard({
  availableBalance,
  pendingBalance,
  paidAmount,
  todayEarnings,
  weekEarnings,
  monthEarnings,
  lifetimeEarnings,
  totalTransactions,
  onPayoutPress,
}: BalanceSummaryCardProps) {
  return (
    <VStack className="gap-4">
      <Box className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0C1532]/95 px-5 py-5">
        <HStack className="items-center justify-between gap-3">
          <HStack className="min-w-0 flex-1 items-center gap-4">
            <Box className="h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#111C42]">
              <Wallet
                color={astroColors.gold}
                size={28}
                strokeWidth={2.2}
              />
            </Box>

            <Box className="min-w-0 flex-1">
              <Text
                style={{
                  color: astroColors.muted,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                Available Balance
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: astroColors.white,
                  fontFamily: "Inter_700Bold",
                  fontSize: 26,
                  lineHeight: 34,
                  marginTop: 4,
                }}
              >
                {formatCurrency(availableBalance)}
              </Text>
            </Box>
          </HStack>

          <Pressable
            accessibilityLabel="Request payout"
            accessibilityRole="button"
            onPress={onPayoutPress}
          >
            <HStack className="items-center gap-2 rounded-2xl border border-astro-gold/40 px-4 py-3">
              <Upload
                color={astroColors.gold}
                size={18}
                strokeWidth={2.1}
              />

              <Text
                style={{
                  color: astroColors.gold,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                Payout
              </Text>
            </HStack>
          </Pressable>
        </HStack>

        <HStack className="mt-5 flex-wrap gap-3">
          <SummaryItem
            icon={
              <Clock3
                color="#FFB48A"
                size={20}
                strokeWidth={2.1}
              />
            }
            label="Pending balance"
            value={formatCurrency(pendingBalance)}
          />

          <SummaryItem
            icon={
              <Landmark
                color="#8DE5B1"
                size={20}
                strokeWidth={2.1}
              />
            }
            label="Paid amount"
            value={formatCurrency(paidAmount)}
          />
        </HStack>
      </Box>

      <Box className="rounded-[28px] border border-white/10 bg-[#0C1532]/95 px-4 py-4">
        <Text
          style={{
            color: astroColors.white,
            fontFamily: "PlayfairDisplay_600SemiBold",
            fontSize: 19,
            lineHeight: 25,
            marginBottom: 14,
          }}
        >
          Earnings Overview
        </Text>

        <HStack className="flex-wrap gap-3">
          <SummaryItem
            icon={
              <CircleDollarSign
                color={astroColors.gold}
                size={20}
                strokeWidth={2.1}
              />
            }
            label="Today"
            value={formatCurrency(todayEarnings)}
          />

          <SummaryItem
            icon={
              <CalendarDays
                color="#8BD3FF"
                size={20}
                strokeWidth={2.1}
              />
            }
            label="This week"
            value={formatCurrency(weekEarnings)}
          />

          <SummaryItem
            icon={
              <CalendarDays
                color="#B8A7FF"
                size={20}
                strokeWidth={2.1}
              />
            }
            label="This month"
            value={formatCurrency(monthEarnings)}
          />

          <SummaryItem
            icon={
              <Landmark
                color="#8DE5B1"
                size={20}
                strokeWidth={2.1}
              />
            }
            label={`Lifetime • ${totalTransactions} transactions`}
            value={formatCurrency(lifetimeEarnings)}
          />
        </HStack>
      </Box>
    </VStack>
  );
}