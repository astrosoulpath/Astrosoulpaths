import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { astroColors } from "@/src/constants/colors";

type Action = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
};

type Props = PropsWithChildren<{
  accent: string;
  description: string;
  eyebrow: string;
  title: string;
  actions?: Action[];
  footer?: string;
}>;

export function CallStageCard({
  accent,
  actions = [],
  children,
  description,
  eyebrow,
  footer,
  title,
}: Props) {
  return (
    <LinearGradient
      colors={["rgba(11, 20, 51, 0.96)", "rgba(5, 10, 28, 0.92)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.shell}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children}
      {actions.length > 0 ? (
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionButton,
                actionToneStyles[action.tone ?? "primary"],
                pressed && styles.actionPressed,
              ]}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </LinearGradient>
  );
}

const actionToneStyles = StyleSheet.create<Record<string, ViewStyle>>({
  danger: {
    backgroundColor: "rgba(220, 38, 38, 0.9)",
  },
  primary: {
    backgroundColor: astroColors.gold,
  },
  secondary: {
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
  },
});

const styles = StyleSheet.create({
  accent: {
    borderRadius: 999,
    height: 10,
    marginBottom: 18,
    width: 56,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16,
  },
  actionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  actionText: {
    color: astroColors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  description: {
    color: astroColors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  eyebrow: {
    color: astroColors.goldBright,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  footer: {
    color: astroColors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
  shell: {
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
  },
  title: {
    color: astroColors.white,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
    marginTop: 6,
  },
});
