import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { VStack } from "@/components/ui/vstack";
import { LinearGradient } from "expo-linear-gradient";
import { Bell } from "lucide-react-native";
import React from "react";
import { View } from "react-native";

interface NotificationBellProps {
  onPress?: () => void;
  className?: string;
  width?: number;
  height?: number;
  showDot?: boolean;
  dotColor?: string;
}

export default function NotificationBell({
  onPress,
  className = "",
  width = 58,
  height = 58,
  showDot = true,
  dotColor = "#FF4D5E",
}: NotificationBellProps) {
  return (
    <Pressable onPress={onPress} className={className}>
      <LinearGradient
        colors={[
          "rgba(18,25,75,0.55)",
          "rgba(28,38,95,0.42)",
          "rgba(18,25,75,0.35)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width,
          height,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,215,106,0.14)",
          overflow: "hidden",
        }}
      >
        <VStack
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: height * 0.42,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
        <VStack
          style={{
            position: "absolute",
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            borderRadius: 19,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.03)",
          }}
        />
        <Icon as={Bell} size="md" color="#F4C542" />
        {showDot ? (
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: dotColor,
              borderWidth: 1.5,
              borderColor: "#0B1445",
            }}
          />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}
