const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type GenerateKundliPayload = {
  name?: string;
  gender?: string;
  birthPlace?: string;
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
  startDate?: string;
  endDate?: string;
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
  success?: boolean;
  data: KundliGeneratedData;
  message?: string;
};

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

export async function generateKundli(
  payload: GenerateKundliPayload,
): Promise<GenerateKundliResponse> {
  const response = await fetch(
    `${getApiBaseUrl()}/kundli/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(
      message || "Failed to generate Kundli.",
    );
  }

  if (!data?.data?.id) {
    throw new Error(
      "The Kundli API returned an invalid response.",
    );
  }

  return data as GenerateKundliResponse;
}