import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { CountryCodeSelector } from "@/components/auth/country-code-selector";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";
import { useAuth } from "@/src/features/auth/auth-provider";
import {
  CountryCodeOption,
  findCountryCodeOption,
} from "@/src/features/auth/country-code-data";

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, "Enter a valid phone number"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const defaultCountryCode =
  findCountryCodeOption("+91") ??
  ({
    code: "+91",
    flag: "🇮🇳",
    isoCode: "IN",
    name: "India",
  } satisfies CountryCodeOption);

export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendOtp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] =
    useState<CountryCodeOption>(defaultCountryCode);

  const form = useForm<LoginFormValues>({
    defaultValues: { phone: "" },
    mode: "onChange",
    resolver: zodResolver(loginSchema),
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      setIsSubmitting(true);
      await sendOtp(`${selectedCountryCode.code}${values.phone}`);
      router.push("/(auth)/otp");
    } catch (error) {
      Alert.alert(
        "Unable to send OTP",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const isSubmitDisabled = !form.formState.isValid || isSubmitting;

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
                <Text style={styles.eyebrow}>Astrologer Access</Text>
                <Text style={styles.title}>Login with OTP</Text>
                <Text style={styles.subtitle}>
                  Enter your 10-digit mobile number to receive a one-time
                  password.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Phone Number</Text>

                <Controller
                  control={form.control}
                  name="phone"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <View
                      style={[
                        styles.inputRow,
                        isPhoneFocused ? styles.inputRowFocused : null,
                      ]}
                    >
                      <CountryCodeSelector
                        containerStyle={styles.countryCodeWrap}
                        onChange={setSelectedCountryCode}
                        pressedStyle={styles.countryCodeWrapPressed}
                        textStyle={styles.countryCode}
                        value={selectedCountryCode}
                      />

                      <View style={styles.inputDivider} />

                      <View style={styles.inputWrap}>
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          blurOnSubmit={false}
                          keyboardType="phone-pad"
                          maxLength={15}
                          onBlur={() => {
                            setIsPhoneFocused(false);
                            onBlur();
                          }}
                          onChangeText={(text) =>
                            onChange(text.replace(/[^\d]/g, "").slice(0, 10))
                          }
                          onFocus={() => setIsPhoneFocused(true)}
                          placeholder="9876543210"
                          placeholderTextColor="rgba(255,255,255,0.38)"
                          returnKeyType="done"
                          selectionColor={astroColors.gold}
                          style={styles.input}
                          value={value}
                        />
                      </View>
                    </View>
                  )}
                />

                <View style={styles.validationWrap}>
                  {form.formState.errors.phone?.message ? (
                    <Text style={styles.error}>
                      {form.formState.errors.phone.message}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actionContainer}>
                  <Button
                    action="primary"
                    disabled={isSubmitDisabled}
                    onPress={() => void handleSubmit()}
                    size="xl"
                    style={[
                      styles.button,
                      isSubmitDisabled ? styles.buttonDisabled : null,
                    ]}
                  >
                    {isSubmitting ? (
                      <ButtonSpinner color={astroColors.white} />
                    ) : (
                      <ButtonText
                        style={[
                          styles.buttonText,
                          isSubmitDisabled ? styles.buttonTextDisabled : null,
                        ]}
                      >
                        Submit
                      </ButtonText>
                    )}
                  </Button>
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
    paddingTop: 24,
  },
  screenContent: {
    flex: 1,
    justifyContent: "center",
  },
  hero: {
    marginBottom: 20,
  },
  eyebrow: {
    color: astroColors.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.1,
    lineHeight: 18,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: astroColors.white,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 8,
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
    marginBottom: 12,
  },
  inputRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(212,167,87,0.24)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    height: 60,
    overflow: "hidden",
  },
  inputRowFocused: {
    borderColor: "rgba(212,167,87,0.7)",
    backgroundColor: "rgba(255,255,255,0.07)",
    shadowColor: "rgba(212,167,87,0.18)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 4,
  },
  countryCodeWrap: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    minWidth: 88,
    paddingHorizontal: 20,
  },
  countryCodeWrapPressed: {
    opacity: 0.82,
  },
  countryCode: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  inputDivider: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: 28,
    marginHorizontal: 4,
    width: 1,
  },
  inputWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingLeft: 20,
    paddingRight: 16,
  },
  input: {
    color: astroColors.white,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    flex: 1,
    height: 22,
    lineHeight: 22,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlignVertical: "center",
    width: "100%",
  },
  validationWrap: {
    justifyContent: "center",
    minHeight: 22,
    marginTop: 8,
  },
  error: {
    color: "#FFC4C4",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  actionContainer: {
    marginTop: 10,
  },
  button: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: astroColors.gold,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 60,
    width: "100%",
    paddingHorizontal: 16,
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
});
