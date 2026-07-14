const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type PublicDashboardStats = {
  verifiedAstrologers: number;
  registeredCustomers: number;
  totalConsultations: number;
  completedConsultations: number;
  activeConsultations: number;
  totalChatMessages: number;
  averageRating: number | null;
  totalReviews: number;
  generatedAt: string;
};

export type PublicDashboardStatsResponse = {
  success: boolean;
  message?: string;
  data: PublicDashboardStats;
};

function getApiBaseUrl(): string {
  const baseUrl =
    API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

async function parseJson(
  response: Response,
): Promise<unknown> {
  return response.json().catch(() => null);
}

function getErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return fallback;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  const message =
    record.message;

  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map(String)
      .join(", ");
  }

  return fallback;
}

export async function getPublicDashboardStats(): Promise<PublicDashboardStatsResponse> {
  const response =
    await fetch(
      `${getApiBaseUrl()}/dashboard/public-stats`,
      {
        cache: "no-store",
      },
    );

  const data =
    await parseJson(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Unable to load dashboard statistics.",
      ),
    );
  }

  return data as PublicDashboardStatsResponse;
}