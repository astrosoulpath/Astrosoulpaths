const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type AstrologerRegistrationPayload = {
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: string;
  languages: string[];
  expertise: string[];
  experienceYears: number;
  consultationPrice: number;
  bio: string;
};

export type PublicAstrologer = {
  id: string;
  bio: string | null;
  gender: string | null;
  languages: string[];
  experience: number;
  pricePerMin: number;
  rating: number;
  isOnline: boolean;
  expertise: string[];
};

export type PublicAstrologersResponse = {
  success: boolean;
  data: PublicAstrologer[];
  meta: {
    total: number;
  };
};

export type PublicAstrologerFilters = {
  search?: string;
  language?: string;
  expertise?: string;
  online?: boolean;
};

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  return API_BASE_URL;
}

export async function registerAstrologer(
  payload: AstrologerRegistrationPayload,
) {
  const token = localStorage.getItem("asp_access_token");

  const response = await fetch(
    `${getApiBaseUrl()}/astrologer/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || "Failed to register astrologer",
    );
  }

  return data;
}

export async function getPublicAstrologers(
  filters: PublicAstrologerFilters = {},
): Promise<PublicAstrologersResponse> {
  const query = new URLSearchParams();

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim());
  }

  if (filters.language?.trim()) {
    query.set("language", filters.language.trim());
  }

  if (filters.expertise?.trim()) {
    query.set("expertise", filters.expertise.trim());
  }

  if (typeof filters.online === "boolean") {
    query.set("online", String(filters.online));
  }

  const queryString = query.toString();

  const response = await fetch(
    `${getApiBaseUrl()}/astrologer/public${
      queryString ? `?${queryString}` : ""
    }`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || "Failed to load astrologers",
    );
  }

  return {
    success: Boolean(data?.success),
    data: Array.isArray(data?.data) ? data.data : [],
    meta: {
      total:
        typeof data?.meta?.total === "number"
          ? data.meta.total
          : 0,
    },
  };
}