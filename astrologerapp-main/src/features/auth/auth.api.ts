import { create, isAxiosError } from "axios";

import {
  SendOtpResponse,
  VerifyOtpResponse,
} from "@/src/features/auth/auth.types";

const authApi = create({
  baseURL: "https://backend-99k3.onrender.com",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export async function sendOtpRequest(phone: string) {
  try {
    const response = await authApi.post<SendOtpResponse>(
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

export async function verifyOtpRequest(phone: string, token: string) {
  try {
    const response = await authApi.post<VerifyOtpResponse>(
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

function getApiErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined;

    return data?.message || data?.error || error.message || "Request failed.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
