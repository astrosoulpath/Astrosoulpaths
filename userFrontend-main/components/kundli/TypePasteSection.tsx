import { Text } from "@/components/ui/text";
import React from "react";
import { TextInput } from "react-native";
import { SectionCard } from "./SectionCard";

type TypePasteSectionProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TypePasteSection({ value, onChange }: TypePasteSectionProps) {
  return (
    <SectionCard>
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">
        Type / Paste Extra Details (Optional)
      </Text>
      <TextInput
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={value}
        onChangeText={onChange}
        placeholder="Nakshatra hints, known birth notes, family lineage, etc."
        placeholderTextColor="#a6906f"
        className="min-h-24 rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10dd] px-4 py-3 text-[#fff2d1]"
      />
    </SectionCard>
  );
}
