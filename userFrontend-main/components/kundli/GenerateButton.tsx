import { Text } from "@/components/ui/text";
import React from "react";
import { ActivityIndicator, Pressable } from "react-native";

type GenerateButtonProps = {
  isLoading?: boolean;
  onPress: () => void;
};

export function GenerateButton({ isLoading, onPress }: GenerateButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      className="mt-1 rounded-2xl border border-[#ffd88a] bg-[#b1182a] px-4 py-4"
      style={{
        shadowColor: "#F6C86E",
        shadowOpacity: 0.24,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff2d0" />
      ) : (
        <Text className="text-center text-base font-bold text-[#fff2d0]">
          Generate Kundli
        </Text>
      )}
    </Pressable>
  );
}
