import React, { useMemo, useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type OtpCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  hasError?: boolean;
};

export default function OtpCodeInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  disabled = false,
  hasError = false,
}: OtpCodeInputProps) {
  const inputRef = useRef<TextInput>(null);

  const cells = useMemo(
    () =>
      Array.from({ length }, (_, index) => ({
        index,
        char: value[index] ?? "",
      })),
    [length, value],
  );

  const focusedIndex = Math.min(value.length, length - 1);

  return (
    <View className="w-full">
      <View className="flex-row items-center justify-center gap-2.5">
        {cells.map((cell) => {
          const isFocused = cell.index === focusedIndex;
          const borderClass = hasError
            ? "border-red-400"
            : isFocused
              ? "border-[rgba(232,193,126,0.95)]"
              : "border-[rgba(232,193,126,0.38)]";

          const backgroundClass = disabled
            ? "bg-[rgba(22,24,58,0.45)]"
            : isFocused
              ? "bg-[rgba(21,28,76,0.9)]"
              : "bg-[rgba(12,16,50,0.74)]";

          return (
            <View
              key={cell.index}
              className={`h-[54px] w-[44px] items-center justify-center rounded-xl border ${borderClass} ${backgroundClass}`}
            >
              <Text className="text-center text-[22px] font-bold text-[#F7F6FF]">
                {cell.char}
              </Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) =>
          onChange(text.replace(/\D/g, "").slice(0, length))
        }
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        className="absolute h-px w-px opacity-0"
        placeholder="Enter OTP"
        placeholderTextColor="rgba(212,214,238,0.66)"
      />

      <Pressable
        className="absolute inset-0"
        onPress={() => {
          if (!disabled) {
            inputRef.current?.focus();
          }
        }}
        disabled={disabled}
      />
    </View>
  );
}
