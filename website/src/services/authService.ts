const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type AuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
};

export type AuthUser = {
  id?: string;
  supabaseId?: string;
  phone?: string | null;
  email?: string | null;
  role?: string;
  isNewUser?: boolean;
  isProfileComplete?: boolean;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
};

export type AuthResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  session?: AuthSession;
  user?: AuthUser;
  nextStep?: string;
  devOtp?: string;
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string | string[];
  error?: string;
  code?: string;
};

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").trim();
}

async function readJsonResponse(
  response: Response,
): Promise<unknown> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");

    return text
      ? {
          message: text,
        }
      : null;
  }

  return response.json().catch(() => null);
}

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const errorData = data as ApiErrorResponse;

  if (Array.isArray(errorData.message)) {
    return errorData.message.join(", ");
  }

  if (
    typeof errorData.message === "string" &&
    errorData.message
  ) {
    return errorData.message;
  }

  if (
    typeof errorData.error === "string" &&
    errorData.error
  ) {
    return errorData.error;
  }

  return fallback;
}

async function postAuthRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, fallbackMessage),
      );
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (
        error.message ===
        "NEXT_PUBLIC_API_BASE_URL is not configured."
      ) {
        throw error;
      }

      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        throw new Error(
          "Unable to connect to the server. Make sure the backend is running.",
        );
      }

      throw error;
    }

    throw new Error(fallbackMessage);
  }
}

export async function sendOtp(
  phone: string,
): Promise<AuthResponse> {
  const normalizedPhone = normalizePhone(phone);

  if (
    !/^\+[1-9]\d{9,14}$/.test(normalizedPhone)
  ) {
    throw new Error(
      "Please enter a valid phone number with country code.",
    );
  }

  return postAuthRequest<AuthResponse>(
    "/auth/send-otp",
    {
      phone: normalizedPhone,
    },
    "Failed to send OTP.",
  );
}

export async function verifyOtp(
  phone: string,
  token: string,
): Promise<AuthResponse> {
  const normalizedPhone = normalizePhone(phone);
  const normalizedToken = token
    .replace(/\D/g, "")
    .trim();

  if (
    !/^\+[1-9]\d{9,14}$/.test(normalizedPhone)
  ) {
    throw new Error(
      "Please enter a valid phone number with country code.",
    );
  }

  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error(
      "Please enter a valid 6-digit OTP.",
    );
  }

  return postAuthRequest<AuthResponse>(
    "/auth/verify-otp",
    {
      phone: normalizedPhone,
      token: normalizedToken,
    },
    "Failed to verify OTP.",
  );
}

export function saveAuthSession(
  response: AuthResponse,
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (response.session?.accessToken) {
    localStorage.setItem(
      "asp_access_token",
      response.session.accessToken,
    );
  }

  if (response.session?.refreshToken) {
    localStorage.setItem(
      "asp_refresh_token",
      response.session.refreshToken,
    );
  }

  if (response.user) {
    localStorage.setItem(
      "asp_user",
      JSON.stringify(response.user),
    );
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("asp_access_token");
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("asp_access_token");
  localStorage.removeItem("asp_refresh_token");
  localStorage.removeItem("asp_user");
  localStorage.removeItem("asp_otp_context");
}