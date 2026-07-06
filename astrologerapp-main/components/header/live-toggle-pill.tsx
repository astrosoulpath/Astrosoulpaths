import { memo, useCallback } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { MotiView } from "moti";

import { GlassCard } from "@/components/common/glass-card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type LiveTogglePillProps = {
  isOnline?: boolean;
  onToggle?: (nextValue: boolean) => void;
  size?: "regular" | "compact";
  style?: StyleProp<ViewStyle>;
};

function LiveTogglePillComponent({
  isOnline = false,
  onToggle,
  size = "regular",
  style,
}: LiveTogglePillProps) {
  const label = isOnline ? "Online" : "Offline";
  const compact = size === "compact";

  const handleToggle = useCallback(() => {
    onToggle?.(!isOnline);
  }, [isOnline, onToggle]);

  return (
    <Pressable
      accessibilityLabel={`Live status ${label}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOnline }}
      onPress={handleToggle}
      style={style}
    >
      <GlassCard
        borderRadius={compact ? 26 : 27}
        contentStyle={[styles.glass, compact && styles.glassCompact]}
        style={[styles.pill, compact && styles.pillCompact]}
      >
        <HStack style={styles.content}>
          <Text style={[styles.label, compact && styles.labelCompact]}>
            {label}
          </Text>
          <View style={[styles.track, compact && styles.trackCompact]}>
            <MotiView
              animate={{
                translateX: isOnline ? (compact ? 19 : 22) : 0,
                backgroundColor: isOnline ? "#F3C873" : "#FFFFFF",
              }}
              transition={{ type: "timing", duration: 180 }}
              style={[styles.thumb, compact && styles.thumbCompact]}
            />
          </View>
        </HStack>
      </GlassCard>
    </Pressable>
  );
}

export const LiveTogglePill = memo(LiveTogglePillComponent);

const styles = StyleSheet.create({
  pill: {
    height: 54,
    minWidth: 154,
  },
  pillCompact: {
    height: 52,
    minWidth: 132,
  },
  glass: {
    justifyContent: "center",
    paddingLeft: 14,
    paddingRight: 8,
  },
  glassCompact: {
    paddingLeft: 12,
    paddingRight: 7,
  },
  content: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 24,
  },
  labelCompact: {
    fontSize: 17,
    lineHeight: 23,
  },
  track: {
    width: 54,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    padding: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  trackCompact: {
    width: 48,
    height: 32,
    borderRadius: 16,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
});
