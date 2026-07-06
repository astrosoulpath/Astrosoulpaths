import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, TextInput, View } from "react-native";
import type { CountryCodeOption } from "../utils/country-codes";

type CountryCodeSelectorModalProps = {
  visible: boolean;
  options: CountryCodeOption[];
  selectedCountryCode: string;
  onClose: () => void;
  onSelect: (option: CountryCodeOption) => void;
};

export default function CountryCodeSelectorModal({
  visible,
  options,
  selectedCountryCode,
  onClose,
  onSelect,
}: CountryCodeSelectorModalProps) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      return (
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.countryCode.toLowerCase().includes(normalizedQuery) ||
        option.callingCode.includes(normalizedQuery)
      );
    });
  }, [options, query]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (option: CountryCodeOption) => {
    setQuery("");
    onSelect(option);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.sheet}>
          <Text style={styles.title}>Choose country code</Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search country or code"
            placeholderTextColor="rgba(197, 198, 214, 0.6)"
            style={styles.searchInput}
          />

          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.countryCode}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = item.countryCode === selectedCountryCode;

              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[styles.row, isSelected ? styles.rowSelected : null]}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.countryName}>{item.name}</Text>
                    <Text style={styles.countryMeta}>{item.countryCode}</Text>
                  </View>
                  <Text style={styles.callingCode}>+{item.callingCode}</Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No country found</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 24, 0.78)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  sheet: {
    maxHeight: "72%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(232, 193, 126, 0.22)",
    backgroundColor: "rgba(16, 20, 54, 0.96)",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    color: "#F4F1FB",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  searchInput: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(232, 193, 126, 0.16)",
    backgroundColor: "rgba(8, 11, 34, 0.84)",
    paddingHorizontal: 14,
    color: "#F2F2FA",
    fontSize: 15,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: "rgba(232, 193, 126, 0.38)",
    backgroundColor: "rgba(232, 193, 126, 0.08)",
  },
  flag: {
    fontSize: 20,
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  countryName: {
    color: "#F4F3F9",
    fontSize: 15,
    fontWeight: "600",
  },
  countryMeta: {
    color: "rgba(218, 220, 236, 0.6)",
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.6,
  },
  callingCode: {
    color: "#F0C978",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyWrap: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(218, 220, 236, 0.72)",
    fontSize: 14,
  },
});
