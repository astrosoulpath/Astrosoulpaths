import { supabase } from "@/lib/supabase/client";
import { create } from "axios";
import { debugAuthorizationHeader, debugSessionSnapshot } from "./auth-debug";

let accessToken: string | null = null;

// The local LAN IP caused unreliable mobile-device networking during testing.
// Use the Render backend by default so physical devices hit the same reachable API.
const DEFAULT_API_BASE_URL = "https://backend-99k3.onrender.com";

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  // Keep a safe hosted fallback for real device testing when no env override exists.
  return DEFAULT_API_BASE_URL;
}

export const resolvedApiBaseUrl = getApiBaseUrl();

if (__DEV__) {
  console.log(`[API] using baseURL: ${resolvedApiBaseUrl}`);
}

type ApiErrorResponse = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  request?: string;

  constructor(
    message: string,
    options?: { status?: number; code?: string; request?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
    this.request = options?.request;
  }
}

function sanitizeApiErrorMessage(status?: number) {
  if (status === 400) {
    return "Invalid request. Please check your input and try again.";
  }
  if (status === 401) {
    return "Authentication failed. Please request OTP again.";
  }
  if (status === 404) {
    return "Service unavailable. Please try again shortly.";
  }
  if (status === 429) {
    return "Too many requests. Please wait and try again.";
  }
  if (status && status >= 500) {
    return "Server error. Please try again in a moment.";
  }
  return "Unable to process request. Please try again.";
}

function extractSafeBackendMessage(error: unknown) {
  const responseData = (error as { response?: { data?: ApiErrorResponse } })
    ?.response?.data;
  const rawMessage = responseData?.message;
  const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;

  if (!message || typeof message !== "string") {
    return null;
  }

  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  // Safe, user-facing auth and validation messages we can preserve from backend.
  const allowedPatterns = [
    "invalid otp",
    "invalid token",
    "invalid code",
    "otp expired",
    "code expired",
    "expired otp",
    "phone",
    "token",
    "verification",
    "unauthorized",
    "too many requests",
    "rate limit",
    "not found",
    "bad request",
  ];

  if (allowedPatterns.some((pattern) => lower.includes(pattern))) {
    return normalized;
  }

  return null;
}

function getRequestLabel(config: { method?: string; url?: string }) {
  const method = (config.method || "GET").toUpperCase();
  const url = config.url || "unknown-url";
  return `${method} ${url}`;
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;

  debugAuthorizationHeader("[API][Auth] setApiAccessToken", token);
}

export async function getApiAccessToken() {
  if (accessToken) {
    debugAuthorizationHeader("[API][Auth] using in-memory token", accessToken);
    return accessToken;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    if (__DEV__) {
      console.warn("[API][Auth] Failed to read Supabase session", {
        message: error.message,
      });
    }
    return null;
  }

  debugSessionSnapshot("[API][Auth] Supabase getSession", session);

  const sessionAccessToken = session?.access_token?.trim() || null;

  if (sessionAccessToken) {
    accessToken = sessionAccessToken;
  }

  return sessionAccessToken;
}

export const apiClient = create({
  baseURL: resolvedApiBaseUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const startTime = Date.now();
  config.headers["x-client-request-start"] = String(startTime);

  const resolvedAccessToken = await getApiAccessToken();

  if (resolvedAccessToken) {
    config.headers.Authorization = `Bearer ${resolvedAccessToken}`;
  }

  debugAuthorizationHeader("[API][Request][AuthHeader]", resolvedAccessToken, {
    request: getRequestLabel(config),
    baseURL: config.baseURL,
  });

  if (__DEV__) {
    console.log("[API][Request]", {
      request: getRequestLabel(config),
      baseURL: config.baseURL,
      hasAuthToken: Boolean(resolvedAccessToken),
    });
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const startAt = Number(response.config.headers["x-client-request-start"]);
      const durationMs = Number.isFinite(startAt) ? Date.now() - startAt : null;

      console.log("[API][Response]", {
        request: getRequestLabel(response.config),
        status: response.status,
        durationMs,
      });
    }

    return response;
  },
  (error) => {
    const status = error?.response?.status as number | undefined;
    const isTimeout = error?.code === "ECONNABORTED";
    const isNetworkFailure = !error?.response;
    const request = getRequestLabel(error?.config || {});

    let message = sanitizeApiErrorMessage(status);

    if (isTimeout) {
      message =
        "Request timed out. Please check your connection and try again.";
    } else if (isNetworkFailure) {
      message =
        "Could not reach server. Ensure backend is running and phone is on same Wi-Fi.";
    } else {
      const backendMessage = extractSafeBackendMessage(error);
      if (backendMessage) {
        message = backendMessage;
      }
    }

    if (__DEV__) {
      console.warn("[API][HandledError]", {
        request,
        status,
        code: error?.code,
        isTimeout,
        isNetworkFailure,
        backendMessage: (error?.response?.data as ApiErrorResponse | undefined)
          ?.message,
        resolvedMessage: message,
      });
    }

    return Promise.reject(
      new ApiError(message, {
        status,
        code: error?.code,
        request,
      }),
    );
  },
);
