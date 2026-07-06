import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { LinearGradient } from "expo-linear-gradient";
import { Wallet } from "lucide-react-native";
import React from "react";

interface WalletCardProps {
  balance: number | string;
  onPress?: () => void;
  className?: string;
  width?: number;
  height?: number;
  iconSize?: number;
  fontSize?: number;
}

export default function WalletCard({
  balance,
  onPress,
  className = "",
  width = 135,
  height = 58,
  iconSize = 34,
  fontSize = 16,
}: WalletCardProps) {
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
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
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
            height: height * 0.45,
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
        <HStack space="sm" className="items-center">
          <LinearGradient
            colors={["rgba(255,215,106,0.18)", "rgba(255,215,106,0.06)"]}
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,215,106,0.10)",
            }}
          >
            <Icon as={Wallet} size="sm" color="#F4C542" />
          </LinearGradient>
          <Text
            style={{
              color: "#F4C542",
              fontSize,
              fontWeight: "700",
              letterSpacing: 0.3,
            }}
          >
            {typeof balance === "number" ? balance.toLocaleString() : balance}
          </Text>
        </HStack>
      </LinearGradient>
    </Pressable>
  );
}
