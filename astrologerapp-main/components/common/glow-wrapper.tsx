import { PropsWithChildren, memo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type GlowWrapperProps = PropsWithChildren<{
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}>;

function GlowWrapperComponent({
  children,
  glowColor = "rgba(212,167,87,0.25)",
  style,
}: GlowWrapperProps) {
  return (
    <View
      style={[
        styles.glow,
        {
          shadowColor: glowColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const GlowWrapper = memo(GlowWrapperComponent);

const styles = StyleSheet.create({
  glow: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 12,
  },
});
