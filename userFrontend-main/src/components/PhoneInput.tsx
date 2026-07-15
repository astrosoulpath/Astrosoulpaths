import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type PhoneInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  editable?: boolean;
};

export default function PhoneInput({
  value,
  onChangeText,
  error,
  editable = true,
}: PhoneInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Phone Number
      </Text>

      <TextInput
        value={value}
        editable={editable}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="+91 9876543210"
        placeholderTextColor="#888"
        onChangeText={onChangeText}
        style={[
          styles.input,
          error && styles.inputError,
        ]}
      />

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 18,
  },

  label: {
    color: "#FFFFFF",
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "600",
  },

  input: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#1E1E1E",
    color: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 16,
  },

  inputError: {
    borderColor: "#EF4444",
  },

  error: {
    color: "#EF4444",
    marginTop: 6,
    fontSize: 13,
  },
});