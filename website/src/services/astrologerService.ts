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

export type PublicAstrologerProfile = PublicAstrologer & {
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

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

export async function registerAstrologer(
  payload: AstrologerRegistrationPayload,
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("asp_access_token")
      : null;

  const response = await fetch(
    `${getApiBaseUrl()}/astrologer/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(
      message || "Failed to register astrologer",
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

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(
      message || "Failed to load astrologers",
    );
  }

  return {
    success: Boolean(data?.success),

    data: Array.isArray(data?.data)
      ? data.data.map((astrologer: Partial<PublicAstrologer>) => ({
          id: String(astrologer.id ?? ""),
          name:
            astrologer.name?.trim() ||
            "Astro Soul Path Astrologer",
          avatarUrl: astrologer.avatarUrl ?? null,
          bio: astrologer.bio ?? null,
          gender: astrologer.gender ?? null,
          languages: Array.isArray(astrologer.languages)
            ? astrologer.languages
            : [],
          experience:
            typeof astrologer.experience === "number"
              ? astrologer.experience
              : 0,
          pricePerMin:
            typeof astrologer.pricePerMin === "number"
              ? astrologer.pricePerMin
              : 0,
          rating:
            typeof astrologer.rating === "number"
              ? astrologer.rating
              : 0,
          isOnline: Boolean(astrologer.isOnline),
          expertise: Array.isArray(astrologer.expertise)
            ? astrologer.expertise
            : [],
        }))
      : [],

    meta: {
      total:
        typeof data?.meta?.total === "number"
          ? data.meta.total
          : 0,
    },
  };
}

export async function getPublicAstrologerById(
  id: string,
): Promise<PublicAstrologerProfileResponse> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new Error("Astrologer ID is required");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/astrologer/public/${encodeURIComponent(
      normalizedId,
    )}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(
      message || "Failed to load astrologer profile",
    );
  }

  const astrologer = data?.data;

  if (!astrologer?.id) {
    throw new Error("Invalid astrologer profile response");
  }

  return {
    success: Boolean(data?.success),

    data: {
      id: String(astrologer.id),

      name:
        typeof astrologer.name === "string" &&
        astrologer.name.trim()
          ? astrologer.name.trim()
          : "Astro Soul Path Astrologer",

      avatarUrl:
        typeof astrologer.avatarUrl === "string"
          ? astrologer.avatarUrl
          : null,

      bio:
        typeof astrologer.bio === "string"
          ? astrologer.bio
          : null,

      gender:
        typeof astrologer.gender === "string"
          ? astrologer.gender
          : null,

      languages: Array.isArray(astrologer.languages)
        ? astrologer.languages
        : [],

      experience:
        typeof astrologer.experience === "number"
          ? astrologer.experience
          : 0,

      pricePerMin:
        typeof astrologer.pricePerMin === "number"
          ? astrologer.pricePerMin
          : 0,

      rating:
        typeof astrologer.rating === "number"
          ? astrologer.rating
          : 0,

      isOnline: Boolean(astrologer.isOnline),

      expertise: Array.isArray(astrologer.expertise)
        ? astrologer.expertise
        : [],

      availability:
        typeof astrologer.availability === "string"
          ? astrologer.availability
          : astrologer.isOnline
            ? "Available for consultation"
            : "Currently offline",

      consultationOptions: {
        chat: Boolean(
          astrologer.consultationOptions?.chat,
        ),
        audioCall: Boolean(
          astrologer.consultationOptions?.audioCall,
        ),
        videoCall: Boolean(
          astrologer.consultationOptions?.videoCall,
        ),
      },
    },
  };
}