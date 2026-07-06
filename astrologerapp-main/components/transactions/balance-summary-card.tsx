import { Upload, Wallet } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { astroColors } from "@/src/constants/colors";

type BalanceSummaryCardProps = {
  availableBalance: number;
  onPayoutPress?: () => void;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

export function BalanceSummaryCard({
  availableBalance,
  onPayoutPress,
}: BalanceSummaryCardProps) {
  return (
    <Box className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0C1532]/95 px-5 py-5">
      <HStack className="items-center justify-between gap-4">
        <HStack className="flex-1 items-center gap-4">
          <Box className="h-14 w-14 items-center justify-center rounded-2xl bg-[#111C42]">
            <Wallet color={astroColors.gold} size={28} strokeWidth={2.2} />
          </Box>

          <Box className="flex-1">
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
              style={{
                color: astroColors.white,
                fontFamily: "Inter_600SemiBold",
                fontSize: 28,
                lineHeight: 34,
                marginTop: 4,
              }}
            >
              {formatCurrency(availableBalance)}
            </Text>
          </Box>
        </HStack>

        <Pressable onPress={onPayoutPress}>
          <HStack className="items-center gap-2 rounded-2xl border border-astro-gold/40 px-5 py-4">
            <Upload color={astroColors.gold} size={18} strokeWidth={2.1} />
            <Text
              style={{
                color: astroColors.gold,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                lineHeight: 18,
              }}
            >
              Payout
            </Text>
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );
}
