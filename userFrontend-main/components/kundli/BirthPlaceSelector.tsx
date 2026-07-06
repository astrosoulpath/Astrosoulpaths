import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useCityAutocomplete } from "@/features/kundli/hooks/useCityAutocomplete";
import { GeoSuggestion } from "@/features/kundli/types/kundli.types";
import React from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SectionCard } from "./SectionCard";

function formatLocationLabel(item: GeoSuggestion) {
  return [item.city, item.state, item.country].filter(Boolean).join(", ");
}

type BirthPlaceSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: GeoSuggestion) => void;
  error?: string;
};

export function BirthPlaceSelector({
  value,
  onChange,
  onSelectSuggestion,
  error,
}: BirthPlaceSelectorProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const isSelectingFromListRef = React.useRef(false);
  const selectionActiveRef = React.useRef(false);
  const {
    suggestions,
    isLoading,
    errorMessage,
    hasSearched,
    clearSuggestions,
  } = useCityAutocomplete(inputValue);

  const onInputChange = React.useCallback(
    (nextValue: string) => {
      selectionActiveRef.current = false;
      setInputValue(nextValue);
      onChange(nextValue);

      if (!nextValue.trim()) {
        clearSuggestions();
      }
    },
    [clearSuggestions, onChange],
  );

  const onSelectItem = React.useCallback(
    (item: GeoSuggestion) => {
      const displayValue = formatLocationLabel(item);
      selectionActiveRef.current = true;

      setInputValue(displayValue);
      onSelectSuggestion?.(item);
      onChange(displayValue);

      isSelectingFromListRef.current = false;
      setIsFocused(false);
      clearSuggestions();
      Keyboard.dismiss();
    },
    [clearSuggestions, onChange, onSelectSuggestion],
  );

  React.useEffect(() => {
    if (selectionActiveRef.current) {
      selectionActiveRef.current = false;
      return;
    }

    const normalizedValue = value.trim();

    if (inputValue !== value) {
      setInputValue(value);
    }

    if (!normalizedValue) {
      setIsFocused(false);
    }

    clearSuggestions();
  }, [clearSuggestions, inputValue, value]);

  const showDropdown =
    isFocused &&
    inputValue.trim().length > 0 &&
    (isLoading ||
      Boolean(errorMessage) ||
      suggestions.length > 0 ||
      hasSearched);

  const emptyStateVisible =
    !isLoading && !errorMessage && hasSearched && suggestions.length === 0;

  return (
    <SectionCard>
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">
        Birth Place
      </Text>
      <TextInput
        value={inputValue}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          if (isSelectingFromListRef.current) {
            return;
          }

          setIsFocused(false);
        }}
        onChangeText={onInputChange}
        placeholder="City, State, Country"
        placeholderTextColor="#a6906f"
        className="rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10dd] px-4 py-3 text-[#fff2d1]"
      />

      {showDropdown ? (
        <Card className="mt-2 overflow-hidden rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10f2] p-0">
          {isLoading ? (
            <HStack className="items-center gap-2 px-4 py-3">
              <ActivityIndicator size="small" color="#F3C66E" />
              <Text className="text-sm text-[#e7d3ab]">Loading cities...</Text>
            </HStack>
          ) : null}

          {!isLoading && errorMessage ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-[#ff9090]">{errorMessage}</Text>
            </View>
          ) : null}

          {emptyStateVisible ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-[#d8c39d]">No cities found.</Text>
            </View>
          ) : null}

          {!isLoading && !errorMessage && suggestions.length > 0 ? (
            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 220 }}
            >
              {suggestions.map((item, index) => (
                <Pressable
                  key={`${item.city}-${item.state}-${item.countryCode}-${index}`}
                  onPressIn={() => {
                    isSelectingFromListRef.current = true;
                  }}
                  onPress={() => onSelectItem(item)}
                  className="border-b border-[#f3c66e1f] px-4 py-3"
                >
                  <Text className="text-sm text-[#fff2d1]">
                    {formatLocationLabel(item)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Text className="mt-1 text-xs text-[#ff9090]">{error}</Text>
      ) : null}
    </SectionCard>
  );
}
