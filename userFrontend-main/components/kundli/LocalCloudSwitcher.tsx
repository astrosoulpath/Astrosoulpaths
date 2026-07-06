import { KundliStorageMode } from "@/features/kundli/types/kundli.types";
import React from "react";
import { View } from "react-native";

type LocalCloudSwitcherProps = {
  value: KundliStorageMode;
  onChange: (value: KundliStorageMode) => void;
};

export function LocalCloudSwitcher({
  value,
  onChange,
}: LocalCloudSwitcherProps) {
  return <View />;
}
