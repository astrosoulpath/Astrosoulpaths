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

export type ArticleTranslationPayload = {
  locale: string;
  title: string;
  excerpt?: string;
  contentMarkdown: string;
  authorName?: string;
  readingMinutes?: number;
};

export type AstrologerArticle = {
  id: string;
  slug: string;
  category: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  reviewNote?: string | null;
  submittedAt?: string | null;
  updatedAt: string;
  translations: ArticleTranslationPayload[];
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {if(JSON.parse(window.localStorage.getItem('asp_user')||'{}').portal!=='astrologer')return null;}catch{return null;}
  return window.localStorage.getItem("asp_astrologer_access_token");
}
const responseOwners=new WeakMap<Response,string>();
function ownerSnapshot(){const token=getAccessToken();if(!token)throw Error('Astrologer session is missing. Please log in again.');return JSON.stringify([token,window.localStorage.getItem('asp_user')]);}
async function professionalFetch(url:string,init:RequestInit){const owner=ownerSnapshot();const response=await fetch(url,{...init,credentials:'omit',signal:init.signal??AbortSignal.timeout(20000)});if(owner!==ownerSnapshot())throw Error('Account changed. Sign in again.');responseOwners.set(response,owner);return response;}

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Astrologer session is missing. Please log in again.");
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
  if(responseOwners.get(response)!==ownerSnapshot())throw Error('Account changed. Sign in again.');

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
  const response = await professionalFetch(`${API_BASE_URL}/astrologer/dashboard`, {
    method: "GET",
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  return parseResponse<ApiResponse<AstrologerDashboardData>>(
    response,
    "Failed to load astrologer dashboard.",
  );
}

export async function updateAstrologerStatus(
  isOnline: boolean,
): Promise<ApiResponse<{ isOnline: boolean }>> {
  const response = await professionalFetch(`${API_BASE_URL}/astrologer/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isOnline }),
  });

  return parseResponse<ApiResponse<{ isOnline: boolean }>>(
    response,
    "Failed to update astrologer availability.",
  );
}

export async function getMyArticles(): Promise<AstrologerArticle[]> {
  const response = await professionalFetch(`${API_BASE_URL}/astrologer/articles`, {
    method: "GET",
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  return parseResponse<AstrologerArticle[]>(
    response,
    "Failed to load your articles.",
  );
}

export async function submitAstrologerArticle(body: {
  slug: string;
  category: string;
  festivalTags: string[];
  visibilityCountries: string[];
  defaultLocale: string;
  translations: ArticleTranslationPayload[];
}): Promise<AstrologerArticle> {
  const response = await professionalFetch(`${API_BASE_URL}/astrologer/articles`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  return parseResponse<AstrologerArticle>(
    response,
    "Failed to submit article for review.",
  );
}
