const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL;

export type ConsultationMode = "chat" | "audio";

export type StartConsultationPayload = {
  /**
   * Astrologer's linked User.id.
   * This is not Astrologer.id.
   */
  astrologerUserId: string;
  purchasedMinutes: number;
  mode?: ConsultationMode;
};

export type ConsultationParticipant = {
  id: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;

  userProfile?: {
    fullName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type ConsultationSession = {
  id: string;
  userId: string;
  astrologerId: string;
  channelName: string;
  ratePerMinute: number;
  purchasedMinutes: number;
  extendedMinutes: number;
  amountCharged: number;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  status: string;
  createdAt: string;

  user?: ConsultationParticipant;
  astrologer?: ConsultationParticipant;
  earning?: unknown | null;

  _count?: {
    messages: number;
  };
};

export type ConsultationWallet = {
  id?: string;
  balance: number;
  lockedBalance: number;
  currency: string;
};

export type ConsultationTransaction = {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
};

export type ConsultationApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type StartConsultationResponse = {
  success: boolean;
  message?: string;

  data: {
    call: ConsultationSession;
    wallet: ConsultationWallet;
    transaction: ConsultationTransaction;
  };
};

export type ExtendConsultationResponse = {
  success: boolean;
  message?: string;

  /*
   * Backend currently returns the updated consultation
   * directly inside data.
   */
  data: ConsultationSession;

  wallet: ConsultationWallet;
  transaction: ConsultationTransaction;
};

export type ConsultationPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ConsultationHistoryResponse = {
  success: boolean;
  data: ConsultationSession[];
  pagination: ConsultationPagination;
};

export type RatingResponse = {
  success: boolean;
  message?: string;

  data: {
    review: unknown;
    astrologerRating: number;
    totalReviews: number;
  };
};

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_URL is not configured.",
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

  const token =
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token");

  if (!token) {
    throw new Error("LOGIN_REQUIRED");
  }

  return token;
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

function getApiErrorMessage(
  data: unknown,
  fallback: string,
) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data
  ) {
    const message = (
      data as {
        message?: string | string[];
      }
    ).message;

    if (Array.isArray(message)) {
      return message.join(", ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
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
    const message = getApiErrorMessage(
      data,
      `Consultation request failed (${response.status}).`,
    );

    if (response.status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }

    if (response.status === 403) {
      throw new Error(
        message || "CONSULTATION_ACCESS_DENIED",
      );
    }

    const normalizedMessage =
      message.toLowerCase();

    if (
      message === "INSUFFICIENT_BALANCE" ||
      normalizedMessage.includes("insufficient")
    ) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    if (
      normalizedMessage.includes(
        "active consultation",
      )
    ) {
      throw new Error(
        "ACTIVE_CONSULTATION_EXISTS",
      );
    }

    if (
      normalizedMessage.includes("busy")
    ) {
      throw new Error("ASTROLOGER_BUSY");
    }

    if (
      normalizedMessage.includes("unavailable") ||
      normalizedMessage.includes("offline") ||
      normalizedMessage.includes("not approved") ||
      normalizedMessage.includes("unverified")
    ) {
      throw new Error(
        "ASTROLOGER_UNAVAILABLE",
      );
    }

    throw new Error(message);
  }

  return data as T;
}

/*
 * ============================================================
 * START CONSULTATION
 * ============================================================
 */

export async function startConsultation(
  payload: StartConsultationPayload,
): Promise<StartConsultationResponse> {
  const astrologerUserId =
    payload.astrologerUserId.trim();

  if (!astrologerUserId) {
    throw new Error(
      "Astrologer user ID is required.",
    );
  }

  if (
    !Number.isInteger(
      payload.purchasedMinutes,
    ) ||
    payload.purchasedMinutes < 1 ||
    payload.purchasedMinutes > 180
  ) {
    throw new Error(
      "Consultation duration must be between 1 and 180 minutes.",
    );
  }

  return consultationRequest<StartConsultationResponse>(
    "/consultations/start",
    {
      method: "POST",

      body: JSON.stringify({
        astrologerUserId,
        purchasedMinutes:
          payload.purchasedMinutes,

        ...(payload.mode
          ? {
              mode: payload.mode,
            }
          : {}),
      }),
    },
  );
}

/*
 * ============================================================
 * CURRENT CONSULTATIONS
 * ============================================================
 */

export async function getCurrentConsultation(): Promise<
  ConsultationApiResponse<ConsultationSession | null>
> {
  return consultationRequest<
    ConsultationApiResponse<ConsultationSession | null>
  >("/consultations/current");
}

export async function getCurrentAstrologerConsultation(): Promise<
  ConsultationApiResponse<ConsultationSession | null>
> {
  return consultationRequest<
    ConsultationApiResponse<ConsultationSession | null>
  >("/consultations/astrologer/current");
}

/*
 * ============================================================
 * CONSULTATION HISTORY
 * ============================================================
 */

export async function getConsultationHistory(
  page = 1,
  limit = 20,
): Promise<ConsultationHistoryResponse> {
  const safePage = Math.max(
    Math.floor(page),
    1,
  );

  const safeLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    100,
  );

  return consultationRequest<ConsultationHistoryResponse>(
    `/consultations/history?page=${safePage}&limit=${safeLimit}`,
  );
}

export async function getAstrologerConsultationHistory(
  page = 1,
  limit = 20,
): Promise<ConsultationHistoryResponse> {
  const safePage = Math.max(
    Math.floor(page),
    1,
  );

  const safeLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    100,
  );

  return consultationRequest<ConsultationHistoryResponse>(
    `/consultations/astrologer/history?page=${safePage}&limit=${safeLimit}`,
  );
}

/*
 * ============================================================
 * CONSULTATION DETAILS
 * ============================================================
 */

export async function getConsultationById(
  consultationId: string,
): Promise<
  ConsultationApiResponse<ConsultationSession>
> {
  const normalizedId =
    consultationId.trim();

  if (!normalizedId) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  return consultationRequest<
    ConsultationApiResponse<ConsultationSession>
  >(
    `/consultations/${encodeURIComponent(
      normalizedId,
    )}`,
  );
}

/*
 * ============================================================
 * EXTEND CONSULTATION
 * ============================================================
 */

export async function extendConsultation(
  consultationId: string,
  additionalMinutes: number,
): Promise<ExtendConsultationResponse> {
  const normalizedId =
    consultationId.trim();

  if (!normalizedId) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  if (
    !Number.isInteger(additionalMinutes) ||
    additionalMinutes < 1 ||
    additionalMinutes > 180
  ) {
    throw new Error(
      "Additional minutes must be between 1 and 180.",
    );
  }

  return consultationRequest<ExtendConsultationResponse>(
    `/consultations/${encodeURIComponent(
      normalizedId,
    )}/extend`,
    {
      method: "PATCH",

      body: JSON.stringify({
        additionalMinutes,
      }),
    },
  );
}

/*
 * ============================================================
 * CANCEL CONSULTATION
 * ============================================================
 */

export async function cancelConsultation(
  consultationId: string,
): Promise<
  ConsultationApiResponse<ConsultationSession>
> {
  const normalizedId =
    consultationId.trim();

  if (!normalizedId) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  return consultationRequest<
    ConsultationApiResponse<ConsultationSession>
  >(
    `/consultations/${encodeURIComponent(
      normalizedId,
    )}/cancel`,
    {
      method: "PATCH",
    },
  );
}

/*
 * ============================================================
 * COMPLETE CONSULTATION
 * ============================================================
 */

export async function completeConsultation(
  consultationId: string,
): Promise<
  ConsultationApiResponse<ConsultationSession>
> {
  const normalizedId =
    consultationId.trim();

  if (!normalizedId) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  return consultationRequest<
    ConsultationApiResponse<ConsultationSession>
  >(
    `/consultations/${encodeURIComponent(
      normalizedId,
    )}/complete`,
    {
      method: "PATCH",
    },
  );
}
export async function rateConsultation(
  consultationId: string,
  payload: {
    rating: number;
    comment?: string;
  },
): Promise<RatingResponse> {
  const normalizedId =
    consultationId.trim();

  if (!normalizedId) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  if (
    !Number.isInteger(payload.rating) ||
    payload.rating < 1 ||
    payload.rating > 5
  ) {
    throw new Error(
      "Rating must be between 1 and 5.",
    );
  }

  const comment =
    payload.comment?.trim();

  if (
    comment &&
    comment.length > 1000
  ) {
    throw new Error(
      "Review comment cannot exceed 1000 characters.",
    );
  }

  return consultationRequest<RatingResponse>(
    `/consultations/${encodeURIComponent(
      normalizedId,
    )}/rating`,
    {
      method: "POST",

      body: JSON.stringify({
        rating: payload.rating,

        ...(comment
          ? {
              comment,
            }
          : {}),
      }),
    },
  );
}

/*
 * ============================================================
 * LEGACY CALL API
 *
 * Keep these functions until all old website components
 * have migrated from /call/* to /consultations/*.
 * ============================================================
 */

export type LegacyStartConsultationPayload = {
  astrologerId: string;
  minutes: number;
};

export type LegacyStartConsultationResponse = {
  success: boolean;
  message?: string;

  data: {
    call: ConsultationSession;
    wallet: ConsultationWallet;
    transaction: ConsultationTransaction;
  };
};

export async function startLegacyConsultation(
  payload: LegacyStartConsultationPayload,
): Promise<LegacyStartConsultationResponse> {
  const astrologerId =
    payload.astrologerId.trim();

  if (!astrologerId) {
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

  return consultationRequest<LegacyStartConsultationResponse>(
    "/call/start",
    {
      method: "POST",

      body: JSON.stringify({
        astrologerId,
        minutes: payload.minutes,
      }),
    },
  );
}

export async function endLegacyConsultation(
  callId: string,
  reason?: string,
) {
  const normalizedId = callId.trim();

  if (!normalizedId) {
    throw new Error(
      "Consultation ID is required.",
    );
  }

  const normalizedReason =
    reason?.trim();

  return consultationRequest<{
    success: boolean;
    message?: string;

    data: {
      call: ConsultationSession;
    };
  }>(
    `/call/${encodeURIComponent(
      normalizedId,
    )}/end`,
    {
      method: "POST",

      body: JSON.stringify({
        ...(normalizedReason
          ? {
              reason: normalizedReason,
            }
          : {}),
      }),
    },
  );
}