import { ApiError } from "@/lib/api/axios";
import { setSupabaseSessionFromBackend } from "@/lib/supabase/client";
import { sendOtpVerifiedNotification } from "@/src/services/notifications/notifications.service";
import { useMutation } from "@tanstack/react-query";
import { debugSessionSnapshot } from "../../../lib/api/auth-debug";
import { authApi } from "../api/auth.api";
import { VerifyOtpRequest } from "../api/auth.types";
import { useAuthStore } from "../store/auth.store";

export function useVerifyOtp() {
  const setSession = useAuthStore((state) => state.setSession);
  const clearPendingPhone = useAuthStore((state) => state.clearPendingPhone);

  return useMutation({
    mutationFn: (payload: VerifyOtpRequest) => {
      if (__DEV__) {
        console.log(
          "[useVerifyOtp] → POST https://backend-99k3.onrender.com/auth/verify-otp",
          {
            phone: payload.phone,
            tokenLength: payload.token.length,
          },
        );
      }
      return authApi.verifyOtp(payload);
    },
    onSuccess: async (result, variables) => {
      if (__DEV__) {
        console.log("[useVerifyOtp] ✓ success", {
          phone: variables.phone,
          userId: result.user?.id,
          isNewUser: result.user?.isNewUser,
        });
        debugSessionSnapshot(
          "[useVerifyOtp] backend session payload",
          result.session,
          {
            phone: variables.phone,
          },
        );
      }
      await setSupabaseSessionFromBackend(result.session);
      setSession({
        user: result.user,
        session: result.session,
        nextStep: result.nextStep ?? null,
      });
      clearPendingPhone();

      try {
        await sendOtpVerifiedNotification();
      } catch (error) {
        console.warn("[useVerifyOtp] notification failed", error);
      }

      if (__DEV__) {
        console.log("[useVerifyOtp] session stored", {
          nextStep: result.nextStep,
          isProfileComplete: result.user?.isProfileComplete,
        });
      }
    },
    onError: (error: Error, variables) => {
      const apiError = error instanceof ApiError ? error : null;

      if (__DEV__) {
        console.warn("[useVerifyOtp] handled error", {
          phone: variables.phone,
          message: error.message,
          status: apiError?.status,
          code: apiError?.code,
          request: apiError?.request,
        });
      }
    },
  });
}
