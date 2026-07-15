import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { isAxiosError } from "axios";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  "http://localhost:4000";

const AUTH_STORAGE_KEY = "astrologer.auth.session";

type StoredSession = {
  accessToken?: string | null;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const rawSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawSession) {
      return config;
    }

    const session = JSON.parse(rawSession) as StoredSession;
    const token = session.accessToken?.trim();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Request should still continue if stored session cannot be read.
  }

  return config;
});

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string | string[];
          error?: string;
        }
      | undefined;

    if (Array.isArray(data?.message)) {
      return data.message.join(", ");
    }

    return (
      data?.message ||
      data?.error ||
      error.message ||
      "Request failed."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

export { API_BASE_URL };