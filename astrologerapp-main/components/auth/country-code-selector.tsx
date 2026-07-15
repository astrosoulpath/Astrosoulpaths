import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { Text } from "@/components/ui/text";
import { astroColors } from "@/src/constants/colors";
import {
  CountryCodeOption,
  countryCodeOptions,
} from "@/src/features/auth/country-code-data";

type CountryCodeSelectorProps = {
  value: CountryCodeOption;
  onChange: (option: CountryCodeOption) => void;
  containerStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function CountryCodeSelector({
  value,
  onChange,
  containerStyle,
  pressedStyle,
  textStyle,
}: CountryCodeSelectorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isVisible && query.length > 0) {
      setQuery("");
    }
  }, [isVisible, query]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return countryCodeOptions;
    }

    return countryCodeOptions.filter((option) => {
      const searchableCode = option.code.replace("+", "");

      return (
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.code.includes(normalizedQuery) ||
        searchableCode.includes(normalizedQuery) ||
        option.isoCode.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query]);

  const closeModal = () => {
    setIsVisible(false);
  };

  const handleSelect = (option: CountryCodeOption) => {
    onChange(option);
    closeModal();
  };

  return (
    <>
      <Pressable
        accessibilityHint="Opens country code selector"
        accessibilityLabel={`Selected country code ${value.code}`}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => setIsVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          containerStyle,
          pressed ? styles.triggerPressed : null,
          pressed ? pressedStyle : null,
        ]}
      >
        <Text style={textStyle}>{value.code}</Text>
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={closeModal}
        transparent
        visible={isVisible}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Close country code selector"
            accessibilityRole="button"
            onPress={closeModal}
            style={StyleSheet.absoluteFill}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Select country code</Text>

                <Pressable
                  accessibilityLabel="Close country code selector"
                  accessibilityRole="button"
                  onPress={closeModal}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed ? styles.closeButtonPressed : null,
                  ]}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.searchWrap}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  placeholder="Search country or code"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  selectionColor={astroColors.gold}
                  style={styles.searchInput}
                  value={query}
                />
              </View>

              <FlatList
                contentContainerStyle={styles.listContent}
                data={filteredOptions}
                keyExtractor={(item) => `${item.isoCode}-${item.code}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected =
                    item.isoCode === value.isoCode &&
                    item.code === value.code;

                  return (
                    <Pressable
                      accessibilityLabel={`${item.name} ${item.code}`}
                      accessibilityRole="button"
                      onPress={() => handleSelect(item)}
                      style={({ pressed }) => [
                        styles.option,
                        isSelected ? styles.optionSelected : null,
                        pressed ? styles.optionPressed : null,
                      ]}
                    >
                      <View style={styles.flagWrap}>
                        <Text style={styles.flag}>{item.flag}</Text>
                      </View>

                      <View style={styles.optionTextWrap}>
                        <Text numberOfLines={1} style={styles.optionName}>
                          {item.name}
                        </Text>

                        <Text style={styles.optionCode}>{item.code}</Text>
                      </View>

                      {isSelected ? (
                        <Text style={styles.optionSelectedLabel}>
                          Selected
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                }}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    justifyContent: "center",
  },
  triggerPressed: {
    opacity: 0.82,
  },
  overlay: {
    backgroundColor: "rgba(3, 6, 18, 0.68)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetWrap: {
    justifyContent: "flex-end",
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    height: 5,
    marginBottom: 10,
    width: 56,
  },
  sheet: {
    backgroundColor: "rgba(9, 16, 43, 0.98)",
    borderColor: "rgba(255,255,255,0.08)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "82%",
    paddingBottom: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: astroColors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 22,
  },
  closeButton: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  closeButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  closeButtonText: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  searchWrap: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(212,167,87,0.22)",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: astroColors.white,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    height: 52,
    lineHeight: 20,
    paddingVertical: 0,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 6,
  },
  option: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionPressed: {
    opacity: 0.84,
  },
  optionSelected: {
    backgroundColor: "rgba(212,167,87,0.08)",
    borderColor: "rgba(212,167,87,0.52)",
  },
  flagWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    width: 28,
  },
  flag: {
    fontSize: 20,
    lineHeight: 24,
  },
  optionTextWrap: {
    alignItems: "center",
    columnGap: 12,
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minWidth: 0,
  },
  optionName: {
    color: astroColors.white,
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 20,
  },
  optionCode: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 12,
  },
  optionSelectedLabel: {
    color: astroColors.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 14,
  },
});