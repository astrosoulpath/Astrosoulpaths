import { Text } from "@/components/ui/text";
import { kundliTabs } from "@/features/kundli/constants/theme";
import { KundliTab } from "@/features/kundli/types/kundli.types";
import React from "react";
import { Pressable, View } from "react-native";

type TabSwitcherProps = {
  activeTab: KundliTab;
  onChange: (tab: KundliTab) => void;
};

export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
  return (
    <View className="mb-4 flex-row rounded-2xl border border-[#f3c66e44] bg-[#180c11c9] p-1">
      {kundliTabs.map((tab) => {
        const isActive = activeTab === tab.value;

        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            className={`flex-1 rounded-2xl px-3 py-3 ${isActive ? "bg-[#a91728]" : "bg-transparent"}`}
          >
            <Text
              className={`text-center text-sm font-semibold ${
                isActive ? "text-[#ffe5b2]" : "text-[#d8c39a]"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
