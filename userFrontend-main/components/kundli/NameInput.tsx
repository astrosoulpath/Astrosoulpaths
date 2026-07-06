import { Text } from "@/components/ui/text";
import React from "react";
import { TextInput, View } from "react-native";

type NameInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function NameInput({ value, onChange, error }: NameInputProps) {
  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">
        Full Name
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Enter full birth name"
        placeholderTextColor="#a6906f"
        className="rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10dd] px-4 py-3 text-[#fff2d1]"
      />
      {error ? (
        <Text className="mt-1 text-xs text-[#ff9090]">{error}</Text>
      ) : null}
    </View>
  );
}
