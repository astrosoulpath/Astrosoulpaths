import { Text } from "@/components/ui/text";
import { genderOptions } from "@/features/kundli/constants/theme";
import { KundliGender } from "@/features/kundli/types/kundli.types";
import React from "react";
import { Pressable, View } from "react-native";

type GenderSelectorProps = {
  value: KundliGender;
  onChange: (value: KundliGender) => void;
};

export function GenderSelector({ value, onChange }: GenderSelectorProps) {
  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">Gender</Text>
      <View className="flex-row gap-2">
        {genderOptions.map((option) => {
          const active = value === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`flex-1 rounded-xl border px-3 py-2 ${
                active
                  ? "border-[#f6ce76] bg-[#9f1526]"
                  : "border-[#f3c66e3f] bg-[#1a0d10dd]"
              }`}
            >
              <Text
                className={`text-center text-xs font-semibold ${
                  active ? "text-[#fff0ca]" : "text-[#d5c6a4]"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
