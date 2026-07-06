import { Text } from "@/components/ui/text";
import { KundliStorageMode } from "@/features/kundli/types/kundli.types";
import React from "react";
import { Pressable, View } from "react-native";
import { SectionCard } from "./SectionCard";

type SaveKundliSectionProps = {
  value: KundliStorageMode;
  onChange: (value: KundliStorageMode) => void;
};

export function SaveKundliSection({ value, onChange }: SaveKundliSectionProps) {
  return (
    <SectionCard>
      <Pressable
        onPress={() => onChange(value === "local" ? "cloud" : "local")}
        className="flex-row items-center gap-3"
      >
        <View
          className={`h-5 w-5 rounded border-2 items-center justify-center ${
            value === "local"
              ? "border-[#f6ce76] bg-[#a3172a]"
              : "border-[#f3c66e3f] bg-[#1a0d10dd]"
          }`}
        >
          {value === "local" && (
            <Text className="text-[#fff0ca] text-xs font-bold">✓</Text>
          )}
        </View>
        <Text className="text-sm font-semibold text-[#f5cf87]">
          Save Kundlie
        </Text>
      </Pressable>
    </SectionCard>
  );
}
