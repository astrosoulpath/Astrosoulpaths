import { memo } from "react";
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HStack } from "@/components/ui/hstack";
import { MenuButton } from "@/components/header/menu-button";
import { WalletPill } from "@/components/header/wallet-pill";
import { LiveTogglePill } from "@/components/header/live-toggle-pill";

type TopActionBarProps = {
  balance?: number | string;
  isOnline?: boolean;
  onMenuPress?: () => void;
  onWalletPress?: () => void;
  onToggleOnline?: (nextValue: boolean) => void;
  safeAreaTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

function TopActionBarComponent({
  balance = 32,
  isOnline = false,
  onMenuPress,
  onWalletPress,
  onToggleOnline,
  safeAreaTop = false,
  style,
}: TopActionBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 430;
  const headerSize = compact ? "compact" : "regular";

  return (
    <HStack
      style={[
        styles.root,
        safeAreaTop && { paddingTop: insets.top },
        compact && styles.rootCompact,
        style,
      ]}
    >
      <MenuButton onPress={onMenuPress} size={headerSize} />
      <HStack style={[styles.actions, compact && styles.actionsCompact]}>
        <WalletPill
          amount={balance}
          onPress={onWalletPress}
          size={headerSize}
        />
        <LiveTogglePill
          isOnline={isOnline}
          onToggle={onToggleOnline}
          size={headerSize}
        />
      </HStack>
    </HStack>
  );
}

export const TopActionBar = memo(TopActionBarComponent);

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minHeight: 72,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rootCompact: {
    gap: 6,
  },
  actions: {
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 1,
  },
  actionsCompact: {
    gap: 6,
  },
});
