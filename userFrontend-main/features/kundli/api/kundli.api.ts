import { apiClient } from "@/lib/api/axios";
import {
  CreateKundliRequest,
  CreateKundliResponse,
  GeoSuggestion,
  KundliSummary,
  OpenKundliFilter,
} from "../types/kundli.types";

const KUNDLI_ENDPOINTS = {
  create: "/kundli",
  recent: "/kundli/recent",
  geoSearch: "/geo/search",
};

type GeoSearchResponse = {
  success: boolean;
  message: string;
  data: GeoSuggestion[];
};

export async function createKundli(payload: CreateKundliRequest) {
  if (__DEV__) {
    console.log("[Kundli][POST /kundli] payload", payload);
  }

  const { data } = await apiClient.post<CreateKundliResponse>(
    KUNDLI_ENDPOINTS.create,
    payload,
  );
  return data.kundli;
}

export async function fetchRecentKundlis(filter: OpenKundliFilter) {
  const { data } = await apiClient.get<KundliSummary[]>(
    KUNDLI_ENDPOINTS.recent,
    {
      params: {
        q: filter.query,
        source: filter.source,
      },
    },
  );

  return data;
}

export async function searchGeoSuggestions(city: string, signal?: AbortSignal) {
  if (__DEV__) {
    console.log("[Kundli][POST /geo/search] payload", { city });
  }

  const { data } = await apiClient.post<GeoSearchResponse>(
    KUNDLI_ENDPOINTS.geoSearch,
    { city },
    { signal },
  );

  return data.data ?? [];
}
