const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type AuthSession = {
  accessToken?: string;
  refreshToken?: string;
};

export type AuthResponse = {
  success?: boolean;
  message?: string;
  session?: AuthSession;
  user?: Record<string, unknown>;
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

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

export async function sendOtp(
  phone: string,
): Promise<AuthResponse> {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error("Phone number is required.");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/auth/send-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        phone: normalizedPhone,
      }),
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(message || "Failed to send OTP.");
  }

  return data as AuthResponse;
}

export async function verifyOtp(
  phone: string,
  token: string,
): Promise<AuthResponse> {
  const normalizedPhone = normalizePhone(phone);
  const normalizedToken = token.trim();

  if (!normalizedPhone) {
    throw new Error("Phone number is required.");
  }

  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error("Please enter a valid 6-digit OTP.");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/auth/verify-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        token: normalizedToken,
      }),
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(message || "Failed to verify OTP.");
  }

  return data as AuthResponse;
}