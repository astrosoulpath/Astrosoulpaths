import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

type CustomButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

const BUTTON_STYLES = {
  primary: {
    backgroundColor: "#F4C56D",
    borderColor: "#F4C56D",
    textColor: "#080E37",
  },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(244,197,109,0.24)",
    textColor: "#F6E7B1",
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderColor: "rgba(248,113,113,0.35)",
    textColor: "#FCA5A5",
  },
} as const;

export default function CustomButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
}: CustomButtonProps) {
  const style = BUTTON_STYLES[variant];

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 18,
        backgroundColor: disabled
          ? "rgba(255,255,255,0.08)"
          : pressed
            ? style.backgroundColor
            : style.backgroundColor,
        borderColor: disabled ? "rgba(255,255,255,0.08)" : style.borderColor,
        opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={style.textColor} />
      ) : (
        <Text
          style={{
            color: disabled ? "rgba(255,255,255,0.65)" : style.textColor,
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
