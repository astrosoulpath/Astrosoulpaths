import { Text } from "@/components/ui/text";
import { KundliSummary } from "@/features/kundli/types/kundli.types";
import React from "react";
import { View } from "react-native";

type KundliCardProps = {
  item: KundliSummary;
};

export function KundliCard({ item }: KundliCardProps) {
  return (
    <View
      className="mb-3 rounded-2xl border border-[#f3c66e3f] bg-[#180b10d6] p-4"
      style={{
        shadowColor: "#F3C66E",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Text className="text-base font-bold text-[#ffe8b9]">
        {item.fullName}
      </Text>
      <Text className="mt-1 text-xs text-[#e8d3ac]">
        {item.dateOfBirth} at {item.timeOfBirth}
      </Text>
      <Text className="mt-1 text-xs text-[#d8c39a]">{item.birthPlace}</Text>
    </View>
  );
}
