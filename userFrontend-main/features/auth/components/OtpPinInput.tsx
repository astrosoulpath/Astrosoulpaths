import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

const OTP_LENGTH = 6;

type OtpPinInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  focusTrigger?: number;
};

export default function OtpPinInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = true,
  focusTrigger = 0,
}: OtpPinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 40);

    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    inputRef.current?.focus();
  }, [disabled, focusTrigger]);

  return (
    <View style={[styles.wrapper, hasError ? styles.wrapperError : null]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) =>
          onChange(text.replace(/\D/g, "").slice(0, OTP_LENGTH))
        }
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        textAlign="center"
        caretHidden={false}
        placeholder={isFocused || value.length > 0 ? "" : "329322"}
        placeholderTextColor="rgba(196, 197, 214, 0.26)"
        selection={{ start: value.length, end: value.length }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[styles.input, disabled ? styles.inputDisabled : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 64,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(232, 193, 126, 0.22)",
    backgroundColor: "rgba(11, 14, 44, 0.68)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  wrapperError: {
    borderColor: "rgba(255, 122, 122, 0.75)",
  },
  input: {
    color: "#F4F2FC",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: 12,
    paddingVertical: 14,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  inputDisabled: {
    opacity: 0.72,
  },
});
