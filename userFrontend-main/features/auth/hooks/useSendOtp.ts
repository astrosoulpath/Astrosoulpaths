import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { SendOtpRequest } from "../api/auth.types";
import { useAuthStore } from "../store/auth.store";

export function useSendOtp() {
  const setPendingPhone = useAuthStore((state) => state.setPendingPhone);

  return useMutation({
    mutationFn: async (payload: SendOtpRequest) => {
      if (__DEV__) {
        console.log("[Auth][SendOtp][Mutation] started", {
          phonePreview: `${payload.phone.slice(0, 5)}***`,
        });
      }

      return authApi.sendOtp(payload);
    },
    onSuccess: (result, variables) => {
      setPendingPhone(variables.phone);

      if (__DEV__) {
        console.log("[Auth][SendOtp][Mutation] success", {
          success: result.success,
          message: result.message,
        });
      }
    },
    onError: (error, variables) => {
      if (__DEV__) {
        console.error("[Auth][SendOtp][Mutation] failed", {
          phonePreview: `${variables.phone.slice(0, 5)}***`,
          message: error.message,
        });
      }
    },
    onSettled: () => {
      if (__DEV__) {
        console.log("[Auth][SendOtp][Mutation] settled");
      }
    },
  });
}
