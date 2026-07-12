const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type ConsultationMode =
  | "chat"
  | "audio";

export type StartConsultationPayload = {
  astrologerId: string;
  minutes: number;
};

export type ConsultationSession = {
  id: string;
  userId: string;
  astrologerId: string;
  astrologerName: string;
  astrologerAvatarUrl: string | null;
  channelName: string;
  ratePerMinute: number;
  purchasedMinutes: number;
  extendedMinutes: number;
  totalMinutes: number;
  amountCharged: number;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  status: string;
  createdAt: string;
};

export type StartConsultationResponse = {
  success: boolean;
  message?: string;
  data: {
    call: ConsultationSession;
    wallet: {
      balance: number;
      lockedBalance: number;
      currency: string;
    };
    transaction: {
      id: string;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
    };
  };
};

export type CurrentConsultationResponse = {
  success: boolean;
  data:
    | {
        call: ConsultationSession;
      }
    | null;
};

export type ConsultationHistoryResponse = {
  success: boolean;
  data: {
    calls: ConsultationSession[];
    total: number;
  };
};

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "Consultation can only be accessed from the browser.",
    );
  }

  const token = localStorage.getItem(
    "asp_access_token",
  );

  if (!token) {
    throw new Error("LOGIN_REQUIRED");
  }

  return token;
}

async function readJsonResponse(
  response: Response,
) {
  return response.json().catch(() => null);
}

async function consultationRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(
    `${getApiBaseUrl()}${path}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    if (response.status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }

    if (
      message === "INSUFFICIENT_BALANCE" ||
      String(message)
        .toLowerCase()
        .includes("insufficient")
    ) {
      throw new Error(
        "INSUFFICIENT_BALANCE",
      );
    }

    throw new Error(
      message ||
        "Consultation request failed.",
    );
  }

  return data as T;
}

export async function startConsultation(
  payload: StartConsultationPayload,
): Promise<StartConsultationResponse> {
  if (!payload.astrologerId.trim()) {
    throw new Error(
      "Astrologer ID is required.",
    );
  }

  if (
    !Number.isInteger(payload.minutes) ||
    payload.minutes < 1 ||
    payload.minutes > 120
  ) {
    throw new Error(
      "Consultation duration must be between 1 and 120 minutes.",
    );
  }

  return consultationRequest<StartConsultationResponse>(
    "/call/start",
    {
      method: "POST",
      body: JSON.stringify({
        astrologerId:
          payload.astrologerId.trim(),
        minutes: payload.minutes,
      }),
    },
  );
}

export async function endConsultation(
  callId: string,
  reason?: string,
) {
  if (!callId.trim()) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  return consultationRequest<{
    success: boolean;
    message?: string;
    data: {
      call: ConsultationSession;
    };
  }>(
    `/call/${encodeURIComponent(
      callId.trim(),
    )}/end`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(reason?.trim()
          ? { reason: reason.trim() }
          : {}),
      }),
    },
  );
}

export async function getCurrentConsultation(): Promise<CurrentConsultationResponse> {
  return consultationRequest<CurrentConsultationResponse>(
    "/call/current",
  );
}

export async function getConsultationHistory(): Promise<ConsultationHistoryResponse> {
  return consultationRequest<ConsultationHistoryResponse>(
    "/call/history",
  );
}