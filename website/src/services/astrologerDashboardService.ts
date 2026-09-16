const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000"
).replace(/\/+$/, "");

export type AstrologerDashboardData = {
  astrologerId: string;
  earnings: number;
  todayCalls: number;
  todayChats: number;
  rating: number;
  isOnline: boolean;
  isApproved: boolean;
  isVerified: boolean;
  profileCompletion: number;
  pendingConsultations: number;
  todaySchedule: unknown[];
  languages: string[];
  expertise: string[];
  pricePerMin: number;
  experience: number;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(
    "asp_astrologer_access_token",
  );
}

  

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  if (!token) {
    throw new Error(
      "Astrologer session is missing. Please log in again.",
    );
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(message || fallbackMessage);
  }

  return data as T;
}

export async function getAstrologerDashboard(): Promise<
  ApiResponse<AstrologerDashboardData>
> {
  const response = await fetch(
    `${API_BASE_URL}/astrologer/dashboard`,
    {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store",
    },
  );

  return parseResponse<
    ApiResponse<AstrologerDashboardData>
  >(
    response,
    "Failed to load astrologer dashboard.",
  );
}

export async function updateAstrologerStatus(
  isOnline: boolean,
): Promise<ApiResponse<{ isOnline: boolean }>> {
  const response = await fetch(
    `${API_BASE_URL}/astrologer/status`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ isOnline }),
    },
  );

  return parseResponse<
    ApiResponse<{ isOnline: boolean }>
  >(
    response,
    "Failed to update astrologer availability.",
  );
}
