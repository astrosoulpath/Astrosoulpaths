import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type ViewStyle,
} from "react-native";

type PinInputContextValue = {
  value: string;
  length: number;
  activeIndex: number;
  isFocused: boolean;
  disabled: boolean;
  hasError: boolean;
  focusInput: () => void;
  blurInput: () => void;
  onChange: (value: string) => void;
};

const PinInputContext = createContext<PinInputContextValue | null>(null);

function usePinInput(): PinInputContextValue {
  const ctx = useContext(PinInputContext);
  if (!ctx) {
    throw new Error("PinInputSlot / PinInputField must be inside <PinInput>.");
  }
  return ctx;
}

export type PinInputProps = {
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onValueChange?: (value: string) => void;
  focusTrigger?: number;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  style?: ViewStyle;
};

function PinInput({
  children,
  value,
  onChange,
  onValueChange,
  focusTrigger = 0,
  length = 6,
  autoFocus = true,
  disabled = false,
  hasError = false,
  className,
  style,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const sanitizedValue = useMemo(
    () => value.replace(/\D/g, "").slice(0, length),
    [value, length],
  );

  const activeIndex = useMemo(() => {
    if (!isFocused) {
      return sanitizedValue.length > 0
        ? Math.min(sanitizedValue.length - 1, length - 1)
        : 0;
    }

    return Math.min(sanitizedValue.length, length - 1);
  }, [isFocused, length, sanitizedValue.length]);

  const emitChange = useCallback(
    (nextValue: string) => {
      const normalized = nextValue.replace(/\D/g, "").slice(0, length);
      onChange(normalized);
      onValueChange?.(normalized);
    },
    [length, onChange, onValueChange],
  );

  const focusInputWithRetry = useCallback(() => {
    if (disabled) return;

    // Android can ignore immediate focus right after mutation/button taps.
    // Retry on next frames so the OTP field reliably becomes interactive.
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());
    setTimeout(() => inputRef.current?.focus(), 45);
  }, [disabled]);

  const focusInput = useCallback(() => {
    if (__DEV__) {
      console.log("[PinInput] slot press -> focus request");
    }
    focusInputWithRetry();
  }, [focusInputWithRetry]);

  const blurInput = useCallback(() => {
    inputRef.current?.blur();
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      const normalized = text.replace(/\D/g, "").slice(0, length);
      emitChange(normalized);

      if (__DEV__) {
        console.log("[PinInput] value change", {
          nextLength: normalized.length,
          isComplete: normalized.length === length,
        });
      }

      if (normalized.length === length && __DEV__) {
        console.log("[PinInput] otp complete");
      }
    },
    [emitChange, length],
  );

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key !== "Backspace") {
        return;
      }

      if (__DEV__) {
        console.log("[PinInput] backspace", {
          currentLength: sanitizedValue.length,
        });
      }
    },
    [sanitizedValue.length],
  );

  useEffect(() => {
    if (autoFocus && !disabled) {
      focusInputWithRetry();
      if (__DEV__) {
        console.log("[PinInput] autofocus/focusTrigger -> focus", {
          focusTrigger,
        });
      }
    }
  }, [autoFocus, disabled, focusInputWithRetry, focusTrigger]);

  return (
    <PinInputContext.Provider
      value={{
        value: sanitizedValue,
        length,
        activeIndex,
        isFocused,
        disabled,
        hasError,
        focusInput,
        blurInput,
        onChange: emitChange,
      }}
    >
      <View
        className={`flex-row items-center justify-center ${className ?? ""}`}
        style={[{ gap: 10 }, style]}
      >
        {children}
        <TextInput
          ref={inputRef}
          value={sanitizedValue}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            setIsFocused(true);
            if (__DEV__) {
              console.log("[PinInput] focused", {
                valueLength: sanitizedValue.length,
              });
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            if (__DEV__) {
              console.log("[PinInput] blurred", {
                valueLength: sanitizedValue.length,
              });
            }
          }}
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={length}
          autoFocus={autoFocus}
          autoCorrect={false}
          spellCheck={false}
          caretHidden
          contextMenuHidden={false}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          importantForAutofill="yes"
          blurOnSubmit={false}
          showSoftInputOnFocus
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
          }}
        />
      </View>
    </PinInputContext.Provider>
  );
}

export type PinInputSlotProps = {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
};

function PinInputSlot({ index, children, style }: PinInputSlotProps) {
  const { activeIndex, isFocused, hasError, disabled, focusInput } =
    usePinInput();
  const isActive = isFocused && activeIndex === index;

  const borderColor = hasError
    ? "rgba(248,113,113,0.9)"
    : isActive
      ? "rgba(232,193,126,0.95)"
      : "rgba(232,193,126,0.38)";

  const backgroundColor = disabled
    ? "rgba(22,24,58,0.48)"
    : isActive
      ? "rgba(21,28,76,0.94)"
      : "rgba(12,16,50,0.78)";

  return (
    <Pressable
      onPress={focusInput}
      disabled={disabled}
      style={[
        {
          height: 56,
          width: 46,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          borderWidth: 2,
          borderColor,
          backgroundColor,
          overflow: "hidden",
          ...(isActive && !hasError
            ? {
                shadowColor: "#E8C17E",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.65,
                shadowRadius: 9,
                elevation: 7,
              }
            : hasError
              ? {
                  shadowColor: "rgba(248,113,113,0.6)",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 6,
                  elevation: 4,
                }
              : {}),
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export type PinInputFieldProps = {
  index: number;
};

function PinInputField({ index }: PinInputFieldProps) {
  const { value, activeIndex, isFocused } = usePinInput();
  const char = value[index] ?? "";
  const showCaret = isFocused && activeIndex === index && !char;

  return (
    <View
      style={{
        height: 56,
        width: 46,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {char ? (
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#F7F6FF",
            lineHeight: 22,
          }}
        >
          {char}
        </Text>
      ) : showCaret ? (
        <View
          style={{
            width: 2,
            height: 24,
            borderRadius: 999,
            backgroundColor: "#E8C17E",
          }}
        />
      ) : null}
    </View>
  );
}

PinInput.displayName = "PinInput";
PinInputSlot.displayName = "PinInputSlot";
PinInputField.displayName = "PinInputField";

export { PinInput, PinInputField, PinInputSlot };
