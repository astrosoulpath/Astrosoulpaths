import React from "react";
import { View } from "react-native";

type SectionCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionCard({ children, className = "" }: SectionCardProps) {
  return (
    <View
      className={`rounded-3xl border border-[#f3c66e44] bg-[#13080bcc] p-4 ${className}`}
      style={{
        shadowColor: "#F3C66E",
        shadowOpacity: 0.16,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      {children}
    </View>
  );
}
