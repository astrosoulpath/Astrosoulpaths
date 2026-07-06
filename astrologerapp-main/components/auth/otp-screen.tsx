import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";
import { useAuth } from "@/src/features/auth/auth-provider";

const otpSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});

type OtpFormValues = z.infer<typeof otpSchema>;

export function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingPhone, sendOtp, verifyOtp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const form = useForm<OtpFormValues>({
    defaultValues: { token: "" },
    mode: "onChange",
    resolver: zodResolver(otpSchema),
  });

  const maskedPhone = useMemo(() => {
    if (!pendingPhone) {
      return "your phone";
    }

    return `${pendingPhone.slice(0, 4)} ${pendingPhone.slice(4, 8)} ${pendingPhone.slice(-4)}`;
  }, [pendingPhone]);

  const handleVerify = form.handleSubmit(async (values) => {
    if (!pendingPhone) {
      router.replace("/(auth)/login");
      return;
    }

    try {
      setIsSubmitting(true);
      await verifyOtp(pendingPhone, values.token);
      router.replace("/(drawer)");
    } catch (error) {
      Alert.alert(
        "OTP verification failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleResend = async () => {
    if (!pendingPhone || isResending) {
      return;
    }

    try {
      setIsResending(true);
      await sendOtp(pendingPhone);
      Alert.alert("OTP sent", "A fresh OTP has been sent to your phone.");
    } catch (error) {
      Alert.alert(
        "Unable to resend OTP",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const isVerifyDisabled = !form.formState.isValid || isSubmitting;

  return (
    <AppContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.keyboard}
      >
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            bounces={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 28 },
            ]}
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.screenContent}>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>Verify Access</Text>
                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to {maskedPhone}.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>One-Time Password</Text>

                <Controller
                  control={form.control}
                  name="token"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      blurOnSubmit={false}
                      keyboardType="number-pad"
                      maxLength={6}
                      onBlur={onBlur}
                      onChangeText={(text) =>
                        onChange(text.replace(/[^\d]/g, ""))
                      }
                      placeholder="329322"
                      placeholderTextColor="rgba(255,255,255,0.38)"
                      returnKeyType="done"
                      selectionColor={astroColors.gold}
                      style={styles.input}
                      value={value}
                    />
                  )}
                />

                <View style={styles.validationWrap}>
                  {form.formState.errors.token?.message ? (
                    <Text style={styles.error}>
                      {form.formState.errors.token.message}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actionsSection}>
                  <View style={styles.actionContainer}>
                    <Button
                      action="primary"
                      disabled={isVerifyDisabled}
                      onPress={() => void handleVerify()}
                      size="xl"
                      style={[
                        styles.button,
                        isVerifyDisabled ? styles.buttonDisabled : null,
                      ]}
                    >
                      {isSubmitting ? (
                        <ButtonSpinner color={astroColors.white} />
                      ) : (
                        <ButtonText
                          style={[
                            styles.buttonText,
                            isVerifyDisabled ? styles.buttonTextDisabled : null,
                          ]}
                        >
                          Verify OTP
                        </ButtonText>
                      )}
                    </Button>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    disabled={isResending}
                    onPress={() => void handleResend()}
                    style={({ pressed }) => [
                      styles.linkButton,
                      pressed ? styles.linkPressed : null,
                    ]}
                  >
                    <Text style={styles.linkText}>
                      {isResending ? "Resending..." : "Resend OTP"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  screenContent: {
    flex: 1,
    justifyContent: "center",
  },
  hero: {
    marginBottom: 24,
  },
  eyebrow: {
    color: astroColors.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.1,
    lineHeight: 18,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    color: astroColors.white,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 10,
  },
  subtitle: {
    color: "rgba(255,255,255,0.76)",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "rgba(11, 20, 51, 0.84)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 24,
  },
  label: {
    color: astroColors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(212,167,87,0.24)",
    borderRadius: 18,
    borderWidth: 1,
    color: astroColors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    letterSpacing: 8,
    lineHeight: 28,
    minHeight: 58,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  validationWrap: {
    justifyContent: "center",
    minHeight: 26,
    marginTop: 8,
  },
  error: {
    color: "#FFC4C4",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 18,
    minHeight: 18,
  },
  actionsSection: {
    marginTop: 12,
    rowGap: 18,
  },
  actionContainer: {
    marginTop: 0,
    marginBottom: 0,
  },
  button: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: astroColors.gold,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 60,
    paddingHorizontal: 16,
    width: "100%",
  },
  buttonDisabled: {
    backgroundColor: "rgba(212,167,87,0.24)",
    borderColor: "rgba(212,167,87,0.28)",
    borderWidth: 1,
  },
  buttonText: {
    color: astroColors.background,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    lineHeight: 22,
  },
  buttonTextDisabled: {
    color: "rgba(255,255,255,0.72)",
  },
  linkButton: {
    alignItems: "center",
    minHeight: 24,
    paddingVertical: 8,
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    color: astroColors.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
});
