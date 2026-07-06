import { Text } from "@/components/ui/text";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, View } from "react-native";

type HeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

export function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <View className="relative mb-4 pt-2">
      <Pressable
        onPress={onBack}
        className="absolute left-0 top-0 h-11 w-11 items-center justify-center rounded-2xl border border-[#f3c66e55] bg-[#180b10d6]"
      >
        <ArrowLeft size={22} color="#F3C66E" strokeWidth={2.5} />
      </Pressable>

      <View className="items-center px-12 pt-1">
        <Text className="text-center text-4xl font-bold tracking-tight text-[#f5cd77]">
          {title}
        </Text>
        <Text className="mt-2 text-center text-sm leading-5 text-[#e7d3ab]">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
