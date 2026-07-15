import type {
  AuthUser,
  SendOtpPayload,
  SendOtpResponse,
  StoredAuthSession,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from "./auth.types";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL;

type UnknownRecord =
  Record<string, unknown>;

function getApiBaseUrl(): string {
  const baseUrl =
    API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizePhone(
  phone: string,
): string {
  const normalized =
    phone.trim().replace(/\s+/g, "");

  if (
    !/^\+[1-9]\d{7,14}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Enter a valid phone number with country code.",
    );
  }

  return normalized;
}

function normalizeOtp(
  otp: string,
): string {
  const normalized =
    otp.trim().replace(/\s+/g, "");

  if (!/^\d{4,8}$/.test(normalized)) {
    throw new Error(
      "Enter a valid OTP.",
    );
  }

  return normalized;
}

function getErrorMessage(
  value: unknown,
): string {
  if (!isRecord(value)) {
    return "Authentication request failed.";
  }

  const message =
    value.message;

  if (Array.isArray(message)) {
    return message
      .map(String)
      .join(", ");
  }

  if (
    typeof message === "string" &&
    message.trim()
  ) {
    return message.trim();
  }

  return "Authentication request failed.";
}

async function request<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      `${getApiBaseUrl()}${path}`,
      {
        ...options,

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      },
    );

  const data: unknown =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data),
    );
  }

  return data as T;
}

function getString(
  record: UnknownRecord | null,
  key: string,
): string | null {
  const value =
    record?.[key];

  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function getNumber(
  record: UnknownRecord | null,
  key: string,
): number | null {
  const value =
    record?.[key];

  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function getBoolean(
  record: UnknownRecord,
  key: string,
  fallback = false,
): boolean {
  const value =
    record[key];

  return typeof value === "boolean"
    ? value
    : fallback;
}

function normalizeUser(
  value: unknown,
): AuthUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const id =
    getString(value, "id") ??
    getString(value, "userId");

  if (!id) {
    return null;
  }

  return {
    id,

    supabaseId:
      getString(
        value,
        "supabaseId",
      ),

    phone:
      getString(
        value,
        "phone",
      ),

    email:
      getString(
        value,
        "email",
      ),

    name:
      getString(
        value,
        "name",
      ),

    avatarUrl:
      getString(
        value,
        "avatarUrl",
      ),

    role:
      getString(
        value,
        "role",
      ) ??
      getString(
        value,
        "roleId",
      ),

    isNewUser:
      getBoolean(
        value,
        "isNewUser",
        true,
      ),

    isAstrologer:
      getBoolean(
        value,
        "isAstrologer",
      ),

    isProfileComplete:
      getBoolean(
        value,
        "isProfileComplete",
      ),

    isActive:
      getBoolean(
        value,
        "isActive",
        true,
      ),

    isBlocked:
      getBoolean(
        value,
        "isBlocked",
      ),

    isVerified:
      getBoolean(
        value,
        "isVerified",
      ),
  };
}

function createSession(
  response: VerifyOtpResponse,
): StoredAuthSession {
  const root =
    response as unknown as UnknownRecord;

  const data =
    isRecord(root.data)
      ? root.data
      : null;

  const accessToken =
    getString(
      data,
      "accessToken",
    ) ??
    getString(
      root,
      "accessToken",
    );

  if (!accessToken) {
    throw new Error(
      "Backend did not return an access token.",
    );
  }

  return {
    accessToken,

    refreshToken:
      getString(
        data,
        "refreshToken",
      ) ??
      getString(
        root,
        "refreshToken",
      ),

    expiresAt:
      getNumber(
        data,
        "expiresAt",
      ) ??
      getNumber(
        root,
        "expiresAt",
      ),

    nextStep:
      getString(
        data,
        "nextStep",
      ) ??
      getString(
        root,
        "nextStep",
      ),

    user:
      normalizeUser(
        data?.user ??
          root.user,
      ),
  };
}

export async function sendOtp(
  payload: SendOtpPayload,
): Promise<SendOtpResponse> {
  return request<SendOtpResponse>(
    "/auth/send-otp",
    {
      method: "POST",

      body: JSON.stringify({
        phone:
          normalizePhone(
            payload.phone,
          ),
      }),
    },
  );
}

export async function verifyOtp(
  payload: VerifyOtpPayload,
): Promise<StoredAuthSession> {
  const response =
    await request<VerifyOtpResponse>(
      "/auth/verify-otp",
      {
        method: "POST",

        body: JSON.stringify({
          phone:
            normalizePhone(
              payload.phone,
            ),

          otp:
            normalizeOtp(
              payload.otp,
            ),
        }),
      },
    );

  return createSession(response);
}