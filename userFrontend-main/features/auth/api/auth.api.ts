import { BackendProfilePayload } from "@/features/profile/api/profile.types";
import { ApiError, apiClient } from "@/lib/api/axios";
import {
  GetProfileResponse,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  VerifyOtpSuccessResponse,
} from "./auth.types";

const SEND_OTP_ENDPOINT = "https://backend-99k3.onrender.com/auth/send-otp";
const VERIFY_OTP_ENDPOINT = "https://backend-99k3.onrender.com/auth/verify-otp";
const GET_PROFILE_ENDPOINT = "https://backend-99k3.onrender.com/user/profile";
const SUBMIT_PROFILE_ENDPOINT =
  "https://backend-99k3.onrender.com/user/profile";

export const authApi = {
  async sendOtp(payload: SendOtpRequest) {
    const { data } = await apiClient.post<SendOtpResponse>(
      SEND_OTP_ENDPOINT,
      payload,
    );
    return data;
  },

  async verifyOtp(payload: VerifyOtpRequest) {
    const { data } = await apiClient.post<VerifyOtpResponse>(
      VERIFY_OTP_ENDPOINT,
      payload,
    );

    if (!data.success) {
      throw new ApiError(data.message || "OTP verification failed", {
        status: 400,
        code: data.code,
        request: `POST ${VERIFY_OTP_ENDPOINT}`,
      });
    }

    if (!data.user || !data.session) {
      throw new ApiError("OTP verification response is incomplete", {
        status: 502,
        request: `POST ${VERIFY_OTP_ENDPOINT}`,
      });
    }

    return data as VerifyOtpSuccessResponse;
  },

  async resendOtp(payload: SendOtpRequest) {
    const { data } = await apiClient.post<SendOtpResponse>(
      SEND_OTP_ENDPOINT,
      payload,
    );
    return data;
  },

  async getProfile() {
    const { data } =
      await apiClient.get<GetProfileResponse>(GET_PROFILE_ENDPOINT);

    if (!data.user) {
      throw new ApiError("Profile response is incomplete", {
        status: 502,
        request: `GET ${GET_PROFILE_ENDPOINT}`,
      });
    }

    return data;
  },

  async submitProfile(payload: BackendProfilePayload) {
    try {
      const { data } = await apiClient.post<GetProfileResponse>(
        SUBMIT_PROFILE_ENDPOINT,
        payload,
      );

      if (!data.user) {
        throw new ApiError("Profile response is incomplete", {
          status: 502,
          request: `POST ${SUBMIT_PROFILE_ENDPOINT}`,
        });
      }

      return data;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;

      if (apiError?.status !== 404 && apiError?.status !== 405) {
        throw error;
      }

      const { data } = await apiClient.patch<GetProfileResponse>(
        SUBMIT_PROFILE_ENDPOINT,
        payload,
      );

      if (!data.user) {
        throw new ApiError("Profile response is incomplete", {
          status: 502,
          request: `PATCH ${SUBMIT_PROFILE_ENDPOINT}`,
        });
      }

      return data;
    }
  },
};
