const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type GenerateKundliPayload = {
  name: string;
  gender: string;
  birthPlace: string;
  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  lang?: string;
};

export type KundliPlanet = {
  name: string;
  sign?: string;
  house?: number;
  degree?: number;
  nakshatra?: string;
  retrograde?: boolean;
};

export type KundliDashaPeriod = {
  planet: string;
  level?: string;
  startDate?: string;
  endDate?: string;
  durationYears?: number;
  subPeriods?: KundliDashaPeriod[];
};

export type KundliDosha = {
  name: string;
  present: boolean;
  description?: string;
  remedies?: string[];
};

export type KundliChartData = {
  type: "D1" | "D9";
  houses?: Array<{
    house: number;
    sign?: string;
    planets?: string[];
  }>;
  svg?: string;
  imageUrl?: string;
};

export type KundliGeneratedData = {
  id: string;
  userId?: string | null;
  name: string | null;
  gender?: string | null;
  birthPlace?: string | null;

  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  lang: string;

  hash?: string;
  createdAt: string;
  source?: "provider" | "cache";
  provider?: string;

  ascendant?: string;
  moonSign?: string;
  sunSign?: string;
  nakshatra?: string;

  charts?: {
    d1?: KundliChartData;
    d9?: KundliChartData;
  };

  planets?: KundliPlanet[];
  dashas?: KundliDashaPeriod[];
  doshas?: KundliDosha[];

  pdfUrl?: string | null;
};

export type GenerateKundliResponse = {
  success: boolean;
  data: KundliGeneratedData;
  message?: string;
};

type BackendPlanet = {
  name: string;
  sign?: string;
  sign_id?: number;
  house?: number;
  degree?: number;
  degree_in_sign?: number;
  absolute_degree?: number;
  nakshatra?: string;
  is_retrograde?: boolean;
  retrograde?: boolean;
};

type BackendHouse = {
  house?: number;
  sign?: string;
  sign_id?: number;
  degree_cusp?: number;
};

type BackendChart = {
  division?: number;
  name: string;
  ascendant?: {
    sign?: string;
    sign_id?: number;
    house?: number;
  };
  planets?: BackendPlanet[];
  houses?: BackendHouse[];
};

type BackendDashaPeriod = {
  level?: string;
  lord?: string;
  start?: string;
  end?: string;
  duration_years?: number;
  sub_periods?: BackendDashaPeriod[];
};

type BackendReport = {
  birthChart?: BackendChart | null;
  navamsaChart?: BackendChart | null;
  planetaryPositions?: BackendPlanet[];
  houses?: BackendHouse[];

  ascendant?: {
    degree?: number;
    sign?: string;
    sign_id?: number;
    nakshatra?: {
      id?: number;
      name: string;
      pada?: number;
      lord?: string;
    };
  } | null;

  dasha?: {
    timeline?: BackendDashaPeriod[];
    active_periods?: unknown;
    birth_balance?: unknown;
    moon_nakshatra?: unknown;
  } | null;

  dosha?: unknown;
  yogas?: unknown;
  panchang?: unknown;
  shadbala?: unknown;
  ashtakavarga?: unknown;
  metadata?: unknown;
};

type BackendKundliData = {
  id: string;
  userId?: string | null;
  name?: string | null;
  gender?: string | null;
  birthPlace?: string | null;

  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  lang: string;

  hash?: string;
  createdAt: string;
  source?: "provider" | "cache";
  provider?: string;

  report: BackendReport;
};

type BackendGenerateResponse = {
  success: boolean;
  code?: string;
  message?: string | string[];
  data?: BackendKundliData;
};

export type SavedKundliCustomer = {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
};

export type SavedKundliBirthData = {
  id: string;
  dob: string;
  tob: string;
  latitude: number;
  longitude: number;
  timezone: number;
  createdAt: string;
};

export type SavedKundliSummary = {
  id: string;
  kundliId: string;
  customerUserId?: string | null;
  name: string;
  gender: string;
  birthPlace: string;
  lang: string;
  createdAt: string;
  updatedAt: string;
  kundli: SavedKundliBirthData;
  customerUser?: SavedKundliCustomer | null;
};

export type SavedKundliListResponse = {
  success: boolean;
  data: SavedKundliSummary[];
};

type BackendSavedKundliDetail = {
  id: string;
  kundliId: string;
  customerUserId?: string | null;
  name: string;
  gender: string;
  birthPlace: string;
  lang: string;
  createdAt: string;
  updatedAt: string;
  customerUser?: SavedKundliCustomer | null;
  kundli: SavedKundliBirthData;
  report: BackendReport;
  reportUpdatedAt: string;
};

type BackendSavedKundliDetailResponse = {
  success: boolean;
  code?: string;
  message?: string | string[];
  data?: BackendSavedKundliDetail;
};

export type SavedKundliDetail = {
  savedRecordId: string;
  customerUserId?: string | null;
  customerUser?: SavedKundliCustomer | null;
  reportUpdatedAt: string;
  kundli: KundliGeneratedData;
};

export type SavedKundliDetailResponse = {
  success: boolean;
  data: SavedKundliDetail;
};

export class KundliApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "KundliApiError";
  }
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getKundliAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  let portal: string | undefined;

  try {
    const storedUserValue = localStorage.getItem("asp_user");

    if (storedUserValue) {
      const storedUser = JSON.parse(storedUserValue) as {
        portal?: string;
      };

      portal = storedUser.portal;
    }
  } catch {
    portal = undefined;
  }

  const portalToken =
    portal === "astrologer"
      ? localStorage.getItem("asp_astrologer_access_token")
      : (localStorage.getItem("asp_customer_access_token") ??
        localStorage.getItem("asp_access_token"));

  return (
    portalToken ??
    localStorage.getItem("asp_astrologer_access_token") ??
    localStorage.getItem("asp_customer_access_token") ??
    localStorage.getItem("asp_access_token")
  );
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

function mapChart(
  chart: BackendChart | null | undefined,
  type: "D1" | "D9",
): KundliChartData | undefined {
  if (!chart) {
    return undefined;
  }

  const planets = Array.isArray(chart.planets) ? chart.planets : [];

  const houses = Array.isArray(chart.houses)
    ? chart.houses
        .filter((house) => typeof house.house === "number")
        .map((house) => ({
          house: house.house as number,
          sign: house.sign,
          planets: planets
            .filter((planet) => planet.house === house.house)
            .map((planet) => planet.name || "Unknown"),
        }))
    : [];

  return {
    type,
    houses,
  };
}

function mapPlanet(planet: BackendPlanet): KundliPlanet {
  const degree =
    typeof planet.degree_in_sign === "number"
      ? planet.degree_in_sign
      : typeof planet.degree === "number"
        ? planet.degree
        : typeof planet.absolute_degree === "number"
          ? planet.absolute_degree
          : undefined;

  return {
    name: planet.name || "Unknown",
    sign: planet.sign,
    house: planet.house,
    degree,
    nakshatra: planet.nakshatra,
    retrograde: planet.is_retrograde ?? planet.retrograde ?? false,
  };
}

function mapDashaPeriod(period: BackendDashaPeriod): KundliDashaPeriod {
  return {
    planet: period.lord || "Unknown",
    level: period.level,
    startDate: period.start,
    endDate: period.end,
    durationYears: period.duration_years,
    subPeriods: Array.isArray(period.sub_periods)
      ? period.sub_periods.map(mapDashaPeriod)
      : [],
  };
}

function normalizeKundliData(backend: BackendKundliData): KundliGeneratedData {
  const report = backend.report || {};

  const planets = Array.isArray(report.planetaryPositions)
    ? report.planetaryPositions.map(mapPlanet)
    : [];

  const sun = planets.find((planet) => planet.name.toLowerCase() === "sun");

  const moon = planets.find((planet) => planet.name.toLowerCase() === "moon");

  const dashas = Array.isArray(report.dasha?.timeline)
    ? report.dasha.timeline.map(mapDashaPeriod)
    : [];

  return {
    id: backend.id,
    userId: backend.userId ?? null,
    name: backend.name ?? null,
    gender: backend.gender ?? null,
    birthPlace: backend.birthPlace ?? null,

    dob: backend.dob,
    tob: backend.tob,
    lat: backend.lat,
    lon: backend.lon,
    timezone: backend.timezone,
    lang: backend.lang,

    hash: backend.hash,
    createdAt: backend.createdAt,
    source: backend.source,
    provider: backend.provider,

    ascendant: report.ascendant?.sign,

    moonSign: moon?.sign,

    sunSign: sun?.sign,

    nakshatra: moon?.nakshatra ?? report.ascendant?.nakshatra?.name,

    charts: {
      d1: mapChart(report.birthChart, "D1"),
      d9: mapChart(report.navamsaChart, "D9"),
    },

    planets,
    dashas,

    // FreeAstro all-in-one response currently
    // does not provide normalized Dosha data.
    doshas: [],

    pdfUrl: null,
  };
}

export async function generateKundli(
  payload: GenerateKundliPayload,
): Promise<GenerateKundliResponse> {
  const token = getKundliAccessToken();

  if (!token) {
    throw new KundliApiError(
      "LOGIN_REQUIRED",
      "Please log in to generate a Kundli.",
      401,
    );
  }

  const response = await fetch(`${getApiBaseUrl()}/kundli/generate`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },

    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = (await readJsonResponse(
    response,
  )) as BackendGenerateResponse | null;

  if (!response.ok) {
    const rawMessage = body?.message;

    const message = Array.isArray(rawMessage)
      ? rawMessage.join(", ")
      : rawMessage;

    const code =
      body?.code ??
      (response.status === 401 ? "LOGIN_REQUIRED" : "KUNDLI_REQUEST_FAILED");

    throw new KundliApiError(
      code,
      message ||
        (response.status === 401
          ? "Please log in again."
          : "Failed to generate Kundli."),
      response.status,
    );
  }

  if (!body?.data?.id) {
    throw new KundliApiError(
      "INVALID_KUNDLI_RESPONSE",
      "The Kundli API returned an invalid response.",
      502,
    );
  }

  return {
    success: body?.success ?? true,
    message: typeof body.message === "string" ? body.message : undefined,
    data: normalizeKundliData(body.data),
  };
}

function getKundliErrorDetails(
  body: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): {
  code: string;
  message: string;
} {
  if (!body || typeof body !== "object") {
    return {
      code: fallbackCode,
      message: fallbackMessage,
    };
  }

  const record = body as {
    code?: unknown;
    message?: unknown;
  };

  const code = typeof record.code === "string" ? record.code : fallbackCode;

  const message = Array.isArray(record.message)
    ? record.message.map(String).join(", ")
    : typeof record.message === "string"
      ? record.message
      : fallbackMessage;

  return {
    code,
    message,
  };
}

function requireKundliAccessToken(): string {
  const token = getKundliAccessToken();

  if (!token) {
    throw new KundliApiError(
      "LOGIN_REQUIRED",
      "Please log in to access professional Kundli records.",
      401,
    );
  }

  return token;
}

export async function getSavedKundlis(): Promise<SavedKundliListResponse> {
  const token = requireKundliAccessToken();

  const response = await fetch(`${getApiBaseUrl()}/kundli/saved`, {
    method: "GET",

    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },

    cache: "no-store",
  });

  const body = (await readJsonResponse(
    response,
  )) as SavedKundliListResponse | null;

  if (!response.ok) {
    const error = getKundliErrorDetails(
      body,
      response.status === 401 ? "LOGIN_REQUIRED" : "SAVED_KUNDLI_LIST_FAILED",
      "Unable to load saved Kundli records.",
    );

    throw new KundliApiError(error.code, error.message, response.status);
  }

  if (!body || !Array.isArray(body.data)) {
    throw new KundliApiError(
      "INVALID_SAVED_KUNDLI_LIST",
      "The saved Kundli API returned an invalid response.",
      502,
    );
  }

  return {
    success: body.success,
    data: body.data,
  };
}

export async function getSavedKundli(
  savedRecordId: string,
): Promise<SavedKundliDetailResponse> {
  const normalizedRecordId = savedRecordId.trim();

  if (!normalizedRecordId) {
    throw new KundliApiError(
      "SAVED_KUNDLI_ID_REQUIRED",
      "Saved Kundli record ID is required.",
      400,
    );
  }

  const token = requireKundliAccessToken();

  const response = await fetch(
    `${getApiBaseUrl()}/kundli/saved/${encodeURIComponent(normalizedRecordId)}`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },

      cache: "no-store",
    },
  );

  const body = (await readJsonResponse(
    response,
  )) as BackendSavedKundliDetailResponse | null;

  if (!response.ok) {
    const error = getKundliErrorDetails(
      body,
      response.status === 401
        ? "LOGIN_REQUIRED"
        : "SAVED_KUNDLI_REQUEST_FAILED",
      "Unable to load the saved Kundli.",
    );

    throw new KundliApiError(error.code, error.message, response.status);
  }

  const saved = body?.data;

  if (!saved?.id || !saved.kundli?.id || !saved.report) {
    throw new KundliApiError(
      "INVALID_SAVED_KUNDLI_RESPONSE",
      "The saved Kundli API returned an invalid response.",
      502,
    );
  }

  const normalizedKundli = normalizeKundliData({
    id: saved.kundli.id,
    name: saved.name,
    gender: saved.gender,
    birthPlace: saved.birthPlace,

    dob: saved.kundli.dob,
    tob: saved.kundli.tob,
    lat: saved.kundli.latitude,
    lon: saved.kundli.longitude,
    timezone: saved.kundli.timezone,
    lang: saved.lang,

    createdAt: saved.createdAt,
    source: "cache",
    report: saved.report,
  });

  return {
    success: body?.success ?? true,
    data: {
      savedRecordId: saved.id,

      customerUserId: saved.customerUserId ?? null,

      customerUser: saved.customerUser ?? null,

      reportUpdatedAt: saved.reportUpdatedAt,

      kundli: normalizedKundli,
    },
  };
}

export async function downloadSavedKundliPdf(
  savedRecordId: string,
): Promise<void> {
  const normalizedRecordId = savedRecordId.trim();

  if (!normalizedRecordId) {
    throw new KundliApiError(
      "SAVED_KUNDLI_ID_REQUIRED",
      "Saved Kundli record ID is required.",
      400,
    );
  }

  if (typeof window === "undefined") {
    throw new KundliApiError(
      "BROWSER_REQUIRED",
      "PDF download is available only in the browser.",
      400,
    );
  }

  const token = requireKundliAccessToken();

  const response = await fetch(
    `${getApiBaseUrl()}/kundli/saved/${encodeURIComponent(
      normalizedRecordId,
    )}/pdf`,
    {
      method: "GET",

      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${token}`,
      },

      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await readJsonResponse(response);

    const error = getKundliErrorDetails(
      body,
      response.status === 401 ? "LOGIN_REQUIRED" : "KUNDLI_PDF_DOWNLOAD_FAILED",
      "Unable to download the Kundli PDF.",
    );

    throw new KundliApiError(error.code, error.message, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new KundliApiError(
      "INVALID_KUNDLI_PDF_RESPONSE",
      "The server returned an invalid PDF response.",
      502,
    );
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new KundliApiError(
      "EMPTY_KUNDLI_PDF",
      "The generated Kundli PDF is empty.",
      502,
    );
  }

  const contentDisposition = response.headers.get("content-disposition");

  const fileNameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);

  const fileName =
    fileNameMatch?.[1]?.trim() || `kundli-${normalizedRecordId}.pdf`;

  const objectUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 1000);
}
