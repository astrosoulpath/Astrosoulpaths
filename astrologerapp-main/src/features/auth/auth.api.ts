import { apiClient, getApiErrorMessage } from "@/src/lib/api-client";

import {
  SendOtpResponse,
  VerifyOtpResponse,
} from "@/src/features/auth/auth.types";

export async function sendOtpRequest(phone: string) {
  try {
    const response = await apiClient.post<SendOtpResponse>(
      "/auth/astrologer/send-otp",
      {
        phone,
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function verifyOtpRequest(
  phone: string,
  token: string,
) {
  try {
    const response = await apiClient.post<VerifyOtpResponse>(
      "/auth/astrologer/verify-otp",
      {
        phone,
        token,
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}