import { Menu } from "lucide-react-native";
import { memo, useCallback, useState } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { MotiView } from "moti";

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
  const [pressed, setPressed] = useState(false);
  const compact = size === "compact";

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  return (
    <MotiView
      animate={{ scale: pressed ? 0.96 : 1 }}
      transition={{ type: "timing", duration: 120 }}
      style={style}
    >
      <Pressable
        accessibilityLabel="Open menu"
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <GlassCard
          borderRadius={compact ? 26 : 29}
          contentStyle={styles.glass}
          style={[styles.button, compact && styles.buttonCompact]}
        >
          <Menu color="#FFFFFF" size={compact ? 31 : 34} strokeWidth={2.55} />
        </GlassCard>
      </Pressable>
    </MotiView>
  );
}

export const MenuButton = memo(MenuButtonComponent);

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
  },
  buttonCompact: {
    width: 52,
    height: 52,
  },
  glass: {
    alignItems: "center",
    justifyContent: "center",
  },
});
