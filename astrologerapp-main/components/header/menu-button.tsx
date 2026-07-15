import { Menu } from "lucide-react-native";
import { memo } from "react";
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { GlassCard } from "@/components/common/glass-card";
import { Pressable } from "@/components/ui/pressable";

type MenuButtonProps = {
  onPress?: () => void;
  size?: "regular" | "compact";
  style?: StyleProp<ViewStyle>;
};

function MenuButtonComponent({
  onPress,
  size = "regular",
  style,
}: MenuButtonProps) {
  const compact = size === "compact";

  return (
    <Pressable
      accessibilityLabel="Open menu"
      accessibilityRole="button"
      onPress={onPress}
      style={style}
    >
      <GlassCard
        borderRadius={compact ? 26 : 29}
        contentStyle={styles.glass}
        style={[
          styles.button,
          compact && styles.buttonCompact,
        ]}
      >
        <Menu
          color="#FFFFFF"
          size={compact ? 31 : 34}
          strokeWidth={2.55}
        />
      </GlassCard>
    </Pressable>
  );
}

export const MenuButton = memo(MenuButtonComponent);

const styles = StyleSheet.create({
  button: {
    height: 58,
    width: 58,
  },
  buttonCompact: {
    height: 52,
    width: 52,
  },
  glass: {
    alignItems: "center",
    justifyContent: "center",
  },
});