import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { SendOtpRequest } from "../api/auth.types";

export function useResendOtp() {
  return useMutation({
    mutationFn: (payload: SendOtpRequest) => authApi.resendOtp(payload),
  });
}
