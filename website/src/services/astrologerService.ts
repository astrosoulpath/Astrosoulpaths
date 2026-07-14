const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

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

  /**
   * Astrologer table ID se alag related User.id.
   * Socket incoming call isi ID par bheji jayegi.
   */
  userId: string | null;

  name: string;
  avatarUrl: string | null;
  bio: string | null;
  gender: string | null;
  languages: string[];
  experience: number;
  pricePerMin: number;
  rating: number;
  isOnline: boolean;
  expertise: string[];
};

export type PublicAstrologerProfile =
  PublicAstrologer & {
    availability: string;

    consultationOptions: {
      chat: boolean;
      audioCall: boolean;
      videoCall: boolean;
    };
  };

export type PublicAstrologersResponse = {
  success: boolean;
  data: PublicAstrologer[];
  meta: {
    total: number;
  };
};

export type PublicAstrologerProfileResponse = {
  success: boolean;
  data: PublicAstrologerProfile;
};

export type PublicAstrologerFilters = {
  search?: string;
  language?: string;
  expertise?: string;
  online?: boolean;
};

type ApiErrorResponse = {
  message?: string | string[];
};

type RawPublicAstrologer = {
  id?: unknown;
  userId?: unknown;
  astrologerUserId?: unknown;
  name?: unknown;
  avatarUrl?: unknown;
  bio?: unknown;
  gender?: unknown;
  languages?: unknown;
  experience?: unknown;
  pricePerMin?: unknown;
  rating?: unknown;
  isOnline?: unknown;
  expertise?: unknown;
  availability?: unknown;
  consultationOptions?: {
    chat?: unknown;
    audioCall?: unknown;
    videoCall?: unknown;
  };
};

function getApiBaseUrl(): string {
  const baseUrl =
    API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

async function readJsonResponse(
  response: Response,
): Promise<unknown> {
  return response
    .json()
    .catch(() => null);
}

function getErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  const data =
    payload as ApiErrorResponse | null;

  if (
    Array.isArray(data?.message)
  ) {
    return data.message.join(", ");
  }

  if (
    typeof data?.message === "string" &&
    data.message.trim()
  ) {
    return data.message.trim();
  }

  return fallback;
}

function getString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getNullableString(
  value: unknown,
): string | null {
  const normalized =
    getString(value);

  return normalized || null;
}

function getSafeNumber(
  value: unknown,
  fallback = 0,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function getStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePublicAstrologer(
  raw: RawPublicAstrologer,
): PublicAstrologer {
  const id =
    getString(raw.id);

  const userId =
    getString(raw.userId) ||
    getString(
      raw.astrologerUserId,
    ) ||
    null;

  return {
    id,

    userId,

    name:
      getString(raw.name) ||
      "Astro Soul Path Astrologer",

    avatarUrl:
      getNullableString(
        raw.avatarUrl,
      ),

    bio:
      getNullableString(raw.bio),

    gender:
      getNullableString(
        raw.gender,
      ),

    languages:
      getStringArray(
        raw.languages,
      ),

    experience:
      Math.max(
        0,
        getSafeNumber(
          raw.experience,
        ),
      ),

    pricePerMin:
      Math.max(
        0,
        getSafeNumber(
          raw.pricePerMin,
        ),
      ),

    rating:
      Math.max(
        0,
        Math.min(
          5,
          getSafeNumber(
            raw.rating,
          ),
        ),
      ),

    isOnline:
      Boolean(raw.isOnline),

    expertise:
      getStringArray(
        raw.expertise,
      ),
  };
}

function normalizePublicAstrologerProfile(
  raw: RawPublicAstrologer,
): PublicAstrologerProfile {
  const base =
    normalizePublicAstrologer(
      raw,
    );

  return {
    ...base,

    availability:
      getString(
        raw.availability,
      ) ||
      (base.isOnline
        ? "Available for consultation"
        : "Currently offline"),

    consultationOptions: {
      chat:
        Boolean(
          raw.consultationOptions
            ?.chat,
        ),

      audioCall:
        Boolean(
          raw.consultationOptions
            ?.audioCall,
        ),

      videoCall:
        Boolean(
          raw.consultationOptions
            ?.videoCall,
        ),
    },
  };
}

export async function registerAstrologer(
  payload: AstrologerRegistrationPayload,
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(
          "asp_access_token",
        )
      : null;

  const response =
    await fetch(
      `${getApiBaseUrl()}/astrologer/register`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {}),
        },

        body:
          JSON.stringify(payload),
      },
    );

  const data =
    await readJsonResponse(
      response,
    );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Failed to register astrologer",
      ),
    );
  }

  return data;
}

export async function getPublicAstrologers(
  filters: PublicAstrologerFilters = {},
): Promise<PublicAstrologersResponse> {
  const query =
    new URLSearchParams();

  if (
    filters.search?.trim()
  ) {
    query.set(
      "search",
      filters.search.trim(),
    );
  }

  if (
    filters.language?.trim()
  ) {
    query.set(
      "language",
      filters.language.trim(),
    );
  }

  if (
    filters.expertise?.trim()
  ) {
    query.set(
      "expertise",
      filters.expertise.trim(),
    );
  }

  if (
    typeof filters.online ===
    "boolean"
  ) {
    query.set(
      "online",
      String(filters.online),
    );
  }

  const queryString =
    query.toString();

  const response =
    await fetch(
      `${getApiBaseUrl()}/astrologer/public${
        queryString
          ? `?${queryString}`
          : ""
      }`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },

        cache: "no-store",
      },
    );

  const data =
    await readJsonResponse(
      response,
    );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Failed to load astrologers",
      ),
    );
  }

  const payload =
    data as {
      success?: unknown;
      data?: unknown;
      meta?: {
        total?: unknown;
      };
    } | null;

  const astrologers =
    Array.isArray(
      payload?.data,
    )
      ? payload.data
          .map((item) =>
            normalizePublicAstrologer(
              item as RawPublicAstrologer,
            ),
          )
          .filter(
            (astrologer) =>
              Boolean(
                astrologer.id,
              ),
          )
      : [];

  return {
    success:
      Boolean(
        payload?.success,
      ),

    data:
      astrologers,

    meta: {
      total:
        Math.max(
          0,
          getSafeNumber(
            payload?.meta
              ?.total,
            astrologers.length,
          ),
        ),
    },
  };
}

export async function getPublicAstrologerById(
  id: string,
): Promise<PublicAstrologerProfileResponse> {
  const normalizedId =
    id.trim();

  if (!normalizedId) {
    throw new Error(
      "Astrologer ID is required",
    );
  }

  const response =
    await fetch(
      `${getApiBaseUrl()}/astrologer/public/${encodeURIComponent(
        normalizedId,
      )}`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },

        cache: "no-store",
      },
    );

  const data =
    await readJsonResponse(
      response,
    );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Failed to load astrologer profile",
      ),
    );
  }

  const payload =
    data as {
      success?: unknown;
      data?: RawPublicAstrologer;
    } | null;

  const rawAstrologer =
    payload?.data;

  if (!rawAstrologer) {
    throw new Error(
      "Invalid astrologer profile response",
    );
  }

  const astrologer =
    normalizePublicAstrologerProfile(
      rawAstrologer,
    );

  if (!astrologer.id) {
    throw new Error(
      "Invalid astrologer profile response",
    );
  }

  return {
    success:
      Boolean(
        payload?.success,
      ),

    data:
      astrologer,
  };
}