import { KundliGender } from "@/features/kundli/types/kundli.types";
import React from "react";
import { View } from "react-native";
import { GenderSelector } from "./GenderSelector";
import { NameInput } from "./NameInput";
import { SectionCard } from "./SectionCard";

type ProfileSectionProps = {
  fullName: string;
  onFullNameChange: (value: string) => void;
  gender: KundliGender;
  onGenderChange: (value: KundliGender) => void;
  nameError?: string;
};

export function ProfileSection({
  fullName,
  onFullNameChange,
  gender,
  onGenderChange,
  nameError,
}: ProfileSectionProps) {
  return (
    <SectionCard>
      <View className="gap-3">
        <NameInput
          value={fullName}
          onChange={onFullNameChange}
          error={nameError}
        />
        <GenderSelector value={gender} onChange={onGenderChange} />
      </View>
    </SectionCard>
  );
}
