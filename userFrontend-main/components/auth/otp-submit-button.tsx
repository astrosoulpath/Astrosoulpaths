import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

type OtpSubmitButtonProps = {
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  containerStyle?: ViewStyle;
};

export default function OtpSubmitButton({
  label = "Send OTP",
  onPress,
  disabled,
  loading,
  containerStyle,
}: OtpSubmitButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        containerStyle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={["#EBC27A", "#D6A356", "#E7BC74"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#1A1742" />
        ) : (
          <View style={styles.innerRow}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.iconWrap}>
              <ArrowRight color="#F3C66A" size={14} strokeWidth={2.6} />
            </View>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    borderRadius: 14,
  },
  disabled: {
    opacity: 0.72,
  },
  pressed: {
    transform: [{ scale: 0.995 }],
  },
  gradient: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 219, 151, 0.74)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  innerRow: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  label: {
    color: "#1A1742",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1B1A4D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
});
