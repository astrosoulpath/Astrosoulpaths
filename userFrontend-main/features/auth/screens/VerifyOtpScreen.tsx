import { GlassAuthCard } from "@/components/auth/glass";
import OtpSubmitButton from "@/components/auth/otp-submit-button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { appRoutes } from "@/src/navigation/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LockKeyhole } from "lucide-react-native";
import React, { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OtpPinInput from "../components/OtpPinInput";
import { useOtpCooldown } from "../hooks/useOtpCooldown";
import { useResendOtp } from "../hooks/useResendOtp";
import { useVerifyOtp } from "../hooks/useVerifyOtp";
import {
  VerifyOtpFormValues,
  verifyOtpFormSchema,
} from "../schemas/auth.schemas";
import { useAuthStore } from "../store/auth.store";
import { maskPhone } from "../utils/phone";

const HERO_MAX_WIDTH = 380;
const CARD_MAX_WIDTH = 372;
const CARD_HORIZONTAL_PADDING = 20;
const CARD_VERTICAL_PADDING = 20;
const ERROR_SLOT_MIN_HEIGHT = 46;

/** Format seconds as MM:SS  e.g. 28 → "00:28" */
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VerifyOtpScreen() {
  const { height, width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const pendingPhone = useAuthStore((state) => state.pendingPhone);
  const resolvedPhone = pendingPhone || params.phone || "";
  const [focusTrigger, setFocusTrigger] = React.useState(0);
  const [otpInputInstanceKey, setOtpInputInstanceKey] = React.useState(0);

  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();
  const isVerifying = verifyOtpMutation.isPending;
  const isResending = resendOtpMutation.isPending;
  const { isCoolingDown, secondsLeft, startCooldown } = useOtpCooldown(30);
  const isCompact = height < 760;
  const headingSizeClass =
    width < 360 ? "text-[29px] leading-[36px]" : "text-[32px] leading-[38px]";

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpFormSchema),
    mode: "onChange",
    defaultValues: {
      token: "",
    },
  });

  useEffect(() => {
    if (!resolvedPhone) {
      router.replace("/(auth)/otp-login");
      return;
    }
    startCooldown();
  }, [resolvedPhone, router, startCooldown]);

  const verifyError = useMemo(() => {
    if (!verifyOtpMutation.error) {
      return "";
    }
    return verifyOtpMutation.error.message;
  }, [verifyOtpMutation.error]);

  const resendError = useMemo(() => {
    if (!resendOtpMutation.error) {
      return "";
    }
    return resendOtpMutation.error.message;
  }, [resendOtpMutation.error]);

  const otpValue = watch("token");
  const canSubmitOtp = otpValue.length === 6 && !isVerifying;

  const resetOtpAndRefocus = React.useCallback(() => {
    setValue("token", "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    // Hard remount prevents stale hidden-input references after async actions.
    setOtpInputInstanceKey((current) => current + 1);
    setFocusTrigger((current) => current + 1);
  }, [setValue]);

  useEffect(() => {
    if (__DEV__) {
      console.log("[VerifyOtpScreen] OTP value changed", {
        length: otpValue.length,
        isComplete: otpValue.length === 6,
      });
    }
  }, [otpValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (!resolvedPhone) {
      return;
    }
    if (__DEV__) {
      console.log("[VerifyOtpScreen] submit verify", {
        phone: resolvedPhone,
        tokenLength: values.token.length,
      });
    }
    try {
      const response = await verifyOtpMutation.mutateAsync({
        phone: resolvedPhone,
        token: values.token,
      });

      const nextRoute =
        response.nextStep === "COMPLETE_PROFILE"
          ? appRoutes.onboarding
          : appRoutes.home;

      if (__DEV__) {
        console.log("[VerifyOtpScreen] navigate after verify", {
          nextStep: response.nextStep,
          nextRoute,
        });
      }
      router.replace(nextRoute as never);
    } catch (error) {
      if (__DEV__) {
        console.log("[VerifyOtpScreen] verify failed -> reset otp", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      resetOtpAndRefocus();
    }
  });

  const onResend = async () => {
    if (!resolvedPhone || isCoolingDown || isResending || isVerifying) {
      if (__DEV__) {
        console.log("[VerifyOtpScreen] resend blocked", {
          hasPhone: Boolean(resolvedPhone),
          isCoolingDown,
          isPending: isResending,
        });
      }
      return;
    }
    if (__DEV__) {
      console.log("[VerifyOtpScreen] resend requested", {
        phone: resolvedPhone,
      });
    }
    try {
      await resendOtpMutation.mutateAsync({ phone: resolvedPhone });
      if (__DEV__) {
        console.log(
          "[VerifyOtpScreen] resend success -> reset otp + cooldown restart",
        );
      }
      resetOtpAndRefocus();
      startCooldown();
    } catch (error) {
      if (__DEV__) {
        console.log("[VerifyOtpScreen] resend failed -> refocus otp", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      // Even on resend failure, restore OTP focus so typing never gets stuck.
      setFocusTrigger((current) => current + 1);
    }
  };

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
            isCompact ? "justify-start pt-5" : "justify-start pt-8"
          }`}
        >
          <VStack
            className={`w-full items-center ${isCompact ? "gap-5" : "gap-7"}`}
          >
            <VStack
              className="w-full items-center px-1 pt-1"
              style={styles.heroWrap}
            >
              <Text
                className={`text-center font-extrabold tracking-[0.3px] text-[#F6F7FF] ${headingSizeClass}`}
                style={{
                  textShadowColor: "rgba(5, 8, 34, 0.72)",
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 8,
                }}
              >
                Verify your number
              </Text>

              <Text className="mt-2 max-w-[300px] text-center text-[12px] font-medium leading-[18px] text-[rgba(218,221,242,0.88)]">
                Enter the 6-digit code sent to{" "}
                <Text className="font-bold text-[#E8C17E]">
                  {maskPhone(resolvedPhone)}
                </Text>
              </Text>
            </VStack>

            <VStack className="w-full self-center" style={styles.cardWrap}>
              <GlassAuthCard
                size="md"
                radius="lg"
                elevation="high"
                floatingBadge={
                  <LockKeyhole size={18} color="#F4C56D" strokeWidth={2.3} />
                }
                floatingBadgeSize={56}
                floatingBadgeOffsetY={-28}
                title="Enter verification code"
                subtitle="Code expires in a few minutes"
                titleClassName="text-center text-[20px] font-bold leading-[25px] text-[#F1F2FA]"
                subtitleClassName="mt-1 mb-4 text-center text-[12px] leading-[17px] text-[rgba(214,215,236,0.88)]"
                paddingHorizontal={CARD_HORIZONTAL_PADDING}
                paddingVertical={CARD_VERTICAL_PADDING}
                backgroundColor="rgba(24, 26, 72, 0.86)"
              >
                <Controller
                  control={control}
                  name="token"
                  render={({ field: { value, onChange } }) => (
                    <OtpPinInput
                      key={`otp-input-${otpInputInstanceKey}`}
                      value={value}
                      onChange={onChange}
                      disabled={isVerifying}
                      hasError={Boolean(errors.token?.message || verifyError)}
                      focusTrigger={focusTrigger}
                    />
                  )}
                />

                <VStack className="mt-2" style={styles.errorSlot}>
                  {errors.token?.message ? (
                    <Text style={styles.errorText}>{errors.token.message}</Text>
                  ) : null}

                  {verifyError ? (
                    <Text style={styles.errorText}>{verifyError}</Text>
                  ) : null}
                </VStack>

                <VStack className="mt-4 w-full gap-2.5">
                  <OtpSubmitButton
                    label="Verify OTP"
                    loading={isVerifying}
                    disabled={!canSubmitOtp}
                    onPress={onSubmit}
                  />

                  {/* ── Resend footer ─────────────────────────────────── */}
                  <Pressable
                    className="mt-1 items-center gap-0.5 py-2"
                    onPress={onResend}
                    disabled={isCoolingDown || isResending || isVerifying}
                  >
                    <Text style={styles.resendHelperText}>
                      Didn&apos;t receive the code?
                    </Text>
                    <Text style={styles.resendActionText}>
                      {isCoolingDown
                        ? `Resend OTP in ${formatTimer(secondsLeft)}`
                        : resendOtpMutation.isPending
                          ? "Resending…"
                          : "Resend OTP"}
                    </Text>
                  </Pressable>

                  {resendError ? (
                    <Text style={styles.resendErrorText}>{resendError}</Text>
                  ) : null}
                </VStack>
              </GlassAuthCard>
            </VStack>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    maxWidth: HERO_MAX_WIDTH,
  },
  cardWrap: {
    maxWidth: CARD_MAX_WIDTH,
  },
  errorSlot: {
    minHeight: ERROR_SLOT_MIN_HEIGHT,
  },
  errorText: {
    color: "#FF7A7A",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  resendHelperText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  resendActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  resendErrorText: {
    color: "#FF7A7A",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
