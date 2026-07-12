const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken() {
  if (typeof window === "undefined") {
    throw new Error("Browser only.");
  }

  const token =
    localStorage.getItem(
      "asp_access_token",
    );

  if (!token) {
    throw new Error(
      "LOGIN_REQUIRED",
    );
  }

  return token;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${getApiBaseUrl()}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type":
          "application/json",
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ??
        "Call request failed.",
    );
  }

  return data;
}

/* ---------------- START CALL ---------------- */

export async function startCall(
  astrologerId: string,
  consultationType:
    | "CHAT"
    | "AUDIO" = "AUDIO",
) {
  return request<{
    success: boolean;
    data: {
      id: string;
      channelName: string;
      purchasedMinutes: number;
      expiresAt: string;
    };
  }>("/call/start", {
    method: "POST",
    body: JSON.stringify({
      astrologerId,
      consultationType,
    }),
  });
}

/* ---------------- TOKEN ---------------- */

export async function getCallToken(
  callId: string,
) {
  return request<{
    success: boolean;
    data: {
      appId: string;
      token: string;
      channelName: string;
      uid: number;
      expiresIn: number;
      callId: string;
    };
  }>("/call/token", {
    method: "POST",
    body: JSON.stringify({
      callId,
    }),
  });
}

/* ---------------- CURRENT ---------------- */

export async function getCurrentCall() {
  return request(
    "/call/current",
  );
}

/* ---------------- HISTORY ---------------- */

export async function getCallHistory() {
  return request(
    "/call/history",
  );
}

/* ---------------- END ---------------- */

export async function endCall(
  callId: string,
) {
  return request(
    `/call/${callId}/end`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}