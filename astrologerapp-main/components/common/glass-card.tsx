import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren, memo } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";

import { Box } from "@/components/ui/box";
import { GlowWrapper } from "@/components/common/glow-wrapper";

type GlassCardProps = PropsWithChildren<{
  borderRadius?: number;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

function GlassCardComponent({
  borderRadius = 28,
  children,
  glow = true,
  style,
  contentStyle,
}: GlassCardProps) {
  const card = (
    <Box
      style={[
        styles.shell,
        {
          borderRadius,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={["rgba(8,16,40,0.78)", "rgba(5,12,32,0.68)"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.fill,
          {
            borderRadius,
          },
          contentStyle,
        ]}
      >
        {children}
      </LinearGradient>
    </Box>
  );

  if (!glow) {
    return card;
  }

  return <GlowWrapper>{card}</GlowWrapper>;
}

export const GlassCard = memo(GlassCardComponent);

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,167,87,0.48)",
    backgroundColor: "rgba(8,16,40,0.75)",
  },
  fill: {
    flex: 1,
  },
});
