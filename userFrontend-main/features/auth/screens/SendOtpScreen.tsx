import AuthGlassCard from "@/components/auth/glass";
import OtpSubmitButton from "@/components/auth/otp-submit-button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import type { CountryCode } from "libphonenumber-js";
import { ChevronDown, Smartphone } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CountryCodeSelectorModal from "../components/CountryCodeSelectorModal";
import { useSendOtp } from "../hooks/useSendOtp";
import {
  SendOtpFormValues,
  e164PhoneSchema,
  sendOtpFormSchema,
} from "../schemas/auth.schemas";
import {
  countryCodeOptions,
  type CountryCodeOption,
} from "../utils/country-codes";
import { toE164Phone } from "../utils/phone";

const CARD_MAX_WIDTH = 372;
const HEADING_MAX_WIDTH = 320;
const CARD_HORIZONTAL_PADDING = 16;
const CARD_VERTICAL_PADDING = 16;
const ERROR_SLOT_MIN_HEIGHT = 46;

export default function SendOtpScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const sendOtpMutation = useSendOtp();

  const [countryCode, setCountryCode] = useState<CountryCode>("IN");
  const [callingCode, setCallingCode] = useState("91");
  const [pickerVisible, setPickerVisible] = useState(false);
  const isCompact = height < 760;

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<SendOtpFormValues>({
    resolver: zodResolver(sendOtpFormSchema),
    mode: "onChange",
    defaultValues: {
      callingCode: "91",
      nationalNumber: "",
    },
  });

  const selectedCountry = useMemo(() => {
    return (
      countryCodeOptions.find((option) => option.countryCode === countryCode) ??
      countryCodeOptions[0]
    );
  }, [countryCode]);

  const onSelectCountry = (country: CountryCodeOption) => {
    setCountryCode(country.countryCode);
    setCallingCode(country.callingCode);
    setValue("callingCode", country.callingCode, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const apiError = useMemo(() => {
    if (!sendOtpMutation.error) {
      return "";
    }
    return sendOtpMutation.error.message;
  }, [sendOtpMutation.error]);

  const onSubmit = handleSubmit(async (values) => {
    if (sendOtpMutation.isPending) {
      return;
    }

    const phone = toE164Phone(values.callingCode, values.nationalNumber);
    const parsedPhone = e164PhoneSchema.safeParse(phone);

    if (!parsedPhone.success) {
      setError("nationalNumber", {
        type: "manual",
        message: parsedPhone.error.issues[0]?.message || "Enter a valid number",
      });
      return;
    }

    try {
      await sendOtpMutation.mutateAsync({ phone: parsedPhone.data });

      if (__DEV__) {
        console.log("[Auth][SendOtp] navigate verify screen", {
          phonePreview: `${parsedPhone.data.slice(0, 5)}***`,
        });
      }

      router.push({
        pathname: "/(auth)/verify-otp",
        params: { phone: parsedPhone.data },
      });
    } catch {
      // Error is handled through mutation state and rendered UI message.
    }
  });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-transparent"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={`flex-grow items-center px-5 pb-6 ${
            isCompact ? "justify-center py-5" : "justify-center py-8"
          }`}
        >
          <VStack
            className={`w-full items-center ${isCompact ? "gap-5" : "gap-7"}`}
          >
            <VStack
              className="w-full items-center px-4"
              style={styles.headingWrap}
            >
              <Text
                className="text-center text-[30px] font-extrabold leading-[38px] text-[#FFF8E8]"
                style={{
                  textShadowColor: "rgba(10, 12, 30, 0.32)",
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 6,
                }}
              >
                Welcome to{"\n"}Astro Soul Path
              </Text>
            </VStack>

            <VStack className="w-full self-center" style={styles.cardWrap}>
              <AuthGlassCard
                size="md"
                radius="lg"
                elevation="high"
                floatingBadge={
                  <Smartphone size={18} color="#F4C56D" strokeWidth={2.3} />
                }
                floatingBadgeSize={56}
                floatingBadgeOffsetY={-28}
                title="Enter your mobile number"
                subtitle="We will send you a verification code"
                titleClassName="text-center text-[20px] font-bold leading-[25px] text-[#F1F2FA]"
                subtitleClassName="mt-1 mb-3 text-center text-[12px] leading-[17px] text-[rgba(214,215,236,0.88)]"
                paddingHorizontal={CARD_HORIZONTAL_PADDING}
                paddingVertical={CARD_VERTICAL_PADDING}
                backgroundColor="rgba(24, 26, 72, 0.86)"
                borderGradientColors={[
                  "rgba(228, 185, 106, 0.9)",
                  "rgba(104, 92, 180, 0.58)",
                ]}
                surfaceGradientColors={[
                  "rgba(68, 69, 130, 0.28)",
                  "rgba(35, 35, 92, 0.15)",
                  "rgba(19, 22, 67, 0.76)",
                ]}
                overlayGradientColors={[
                  "rgba(255,255,255,0.08)",
                  "rgba(255,255,255,0.02)",
                  "rgba(228,185,106,0.08)",
                ]}
              >
                <Controller
                  control={control}
                  name="nationalNumber"
                  render={({ field: { value, onChange } }) => (
                    <HStack className="min-h-[54px] items-center rounded-xl border border-[rgba(232,193,126,0.25)] bg-[rgba(11,14,44,0.62)] px-2.5">
                      <Pressable
                        onPress={() => setPickerVisible(true)}
                        className="h-10 min-w-16 flex-row items-center justify-center gap-1.5 rounded-lg px-1"
                      >
                        <Text className="text-[18px] leading-[22px]">
                          {selectedCountry?.flag ?? ""}
                        </Text>
                        <ChevronDown size={12} color="#C4C2D4" />
                      </Pressable>

                      <Text className="ml-1 mr-2 text-[16px] font-semibold leading-[22px] text-[#ECEAF8]">
                        +{callingCode}
                      </Text>

                      <View className="mr-2.5 h-[25px] w-px bg-[rgba(206,195,172,0.30)]" />

                      <TextInput
                        value={value}
                        onChangeText={(text) =>
                          onChange(text.replace(/\D/g, ""))
                        }
                        keyboardType="phone-pad"
                        maxLength={15}
                        editable={!sendOtpMutation.isPending}
                        placeholder="Enter mobile number"
                        placeholderTextColor="rgba(171, 171, 193, 0.62)"
                        className="flex-1 py-2.5"
                        style={{
                          color: "#F1F1FC",
                          fontSize: 16,
                          lineHeight: 20,
                        }}
                      />
                    </HStack>
                  )}
                />

                <VStack className="mt-2" style={styles.errorSlot}>
                  {errors.nationalNumber?.message ? (
                    <Text
                      className="text-sm font-semibold leading-[20px]"
                      style={styles.errorText}
                    >
                      {errors.nationalNumber.message}
                    </Text>
                  ) : null}

                  {errors.callingCode?.message ? (
                    <Text
                      className="text-sm font-semibold leading-[20px]"
                      style={styles.errorText}
                    >
                      {errors.callingCode.message}
                    </Text>
                  ) : null}

                  {apiError ? (
                    <Text
                      className="text-sm font-semibold leading-[20px]"
                      style={styles.errorText}
                    >
                      {apiError}
                    </Text>
                  ) : null}
                </VStack>

                <VStack className="mt-4 w-full">
                  <OtpSubmitButton
                    label="Send OTP"
                    loading={sendOtpMutation.isPending}
                    disabled={sendOtpMutation.isPending}
                    onPress={onSubmit}
                  />
                </VStack>
              </AuthGlassCard>
            </VStack>
          </VStack>

          <CountryCodeSelectorModal
            visible={pickerVisible}
            options={countryCodeOptions}
            selectedCountryCode={countryCode}
            onClose={() => setPickerVisible(false)}
            onSelect={onSelectCountry}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headingWrap: {
    maxWidth: HEADING_MAX_WIDTH,
  },
  cardWrap: {
    maxWidth: CARD_MAX_WIDTH,
    width: "100%",
  },
  errorSlot: {
    minHeight: ERROR_SLOT_MIN_HEIGHT,
  },
  errorText: {
    color: "#FF7A7A",
  },
});
