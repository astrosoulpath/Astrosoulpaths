import { WalletCards } from "lucide-react-native";
import { memo, useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { GlassCard } from "@/components/common/glass-card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type HeaderSize = "regular" | "compact";

type WalletPillProps = {
  amount?: number | string;
  onPress?: () => void;
  size?: HeaderSize;
  style?: StyleProp<ViewStyle>;
};

function formatIndianCurrency(amount: number | string) {
  if (typeof amount === "string") {
    return amount.startsWith("₹")
      ? amount
      : `₹ ${amount}`;
  }

  return `₹ ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function WalletPillComponent({
  amount = 0,
  onPress,
  size = "regular",
  style,
}: WalletPillProps) {
  const balance = useMemo(
    () => formatIndianCurrency(amount),
    [amount],
  );

  const compact = size === "compact";

  return (
    <Pressable
      accessibilityLabel={`Wallet balance ${balance}`}
      accessibilityRole="button"
      onPress={onPress}
      style={style}
    >
      <GlassCard
        borderRadius={compact ? 26 : 27}
        contentStyle={[
          styles.glass,
          compact && styles.glassCompact,
        ]}
        style={[
          styles.pill,
          compact && styles.pillCompact,
        ]}
      >
        <HStack style={styles.content}>
          <WalletCards
            color="#F3C873"
            size={compact ? 27 : 29}
            strokeWidth={2.25}
          />

          <Text
            style={[
              styles.balance,
              compact && styles.balanceCompact,
            ]}
          >
            {balance}
          </Text>
        </HStack>
      </GlassCard>
    </Pressable>
  );
}

export const WalletPill = memo(WalletPillComponent);

const styles = StyleSheet.create({
  pill: {
    height: 54,
    minWidth: 148,
  },
  pillCompact: {
    height: 52,
    minWidth: 126,
  },
  glass: {
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  glassCompact: {
    paddingHorizontal: 12,
  },
  content: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  balance: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 24,
  },
  balanceCompact: {
    fontSize: 17,
    lineHeight: 23,
  },
});