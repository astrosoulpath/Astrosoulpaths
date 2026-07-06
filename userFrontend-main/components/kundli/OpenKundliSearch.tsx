import { Text } from "@/components/ui/text";
import React from "react";
import { TextInput, View } from "react-native";

type OpenKundliSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function OpenKundliSearch({ value, onChange }: OpenKundliSearchProps) {
  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">
        Search Kundli
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search by name or place"
        placeholderTextColor="#a6906f"
        className="rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10dd] px-4 py-3 text-[#fff2d1]"
      />
    </View>
  );
}
