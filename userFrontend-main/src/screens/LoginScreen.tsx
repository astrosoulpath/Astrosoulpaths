import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import PhoneInput from "@/src/components/PhoneInput";
import CustomButton from "@/src/components/CustomButton";
import { useAuth } from "@/src/hooks/useAuth";

export default function LoginScreen() {
  const router = useRouter();

  const { sendOtp } = useAuth();

  const [phone, setPhone] = useState("+91");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    try {
      setLoading(true);
      setError("");

      await sendOtp({
        phone,
      });

      router.push({
        pathname: "/verify-otp",
        params: {
          phone,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send OTP.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Welcome
        </Text>

        <Text style={styles.subtitle}>
          Login using your mobile number
        </Text>

        <PhoneInput
          value={phone}
          onChangeText={setPhone}
          error={error}
        />

        <CustomButton
          label="Send OTP"
          loading={loading}
          onPress={handleContinue}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080E37",
    justifyContent: "center",
    padding: 24,
  },

  content: {
    gap: 20,
  },

  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "700",
  },

  subtitle: {
    color: "#B9B9B9",
    fontSize: 16,
    marginBottom: 12,
  },
});