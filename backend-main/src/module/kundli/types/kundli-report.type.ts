export type KundliPlanetaryPosition = {
  name: string;
  full_name?: string;
  longitude: number;
  absolute_degree?: number;
  degree?: number;
  degree_in_sign?: number;
  sign: string;
  zodiac?: string;
  sign_no: number;
  rasi_no: number;
  nakshatra: string;
  nakshatra_number: number;
  nakshatra_pada: number;
  house?: number;
  retro?: boolean;
};
export interface KundliDashaPeriod {
  lord?: string | null;
  level?: string | null;
  start?: string | null;
  end?: string | null;
  prediction?: unknown;
  children?: KundliDashaPeriod[];
}

export interface KundliDashaReport {
  timeline?: KundliDashaPeriod[];
  mahaDasha?: unknown;
  mahaDashaPrediction?: unknown;
  antarDasha?: unknown;
  current?: unknown;
}

export interface KundliChartsReport {
  birthChart?: unknown;
  navamsaChart?: unknown;
  divisionalCharts?: Record<string, unknown> | null;
}

export interface KundliReport {
  provider: string;
  language: string;

  status?: string;
  generatedAt?: string;

  completeness?: {
    corePercent?: number;
    availableCoreSections?: number;
    totalCoreSections?: number;
  };

  input?: {
    dob?: string;
    tob?: string;
    latitude?: number;
    longitude?: number;
    timezone?: number;
    language?: string;
  };

  charts?: KundliChartsReport;

  birthChart?: unknown;
  navamsaChart?: unknown;

  planetaryPositions?: KundliPlanetaryPosition[] | Record<string, any>[];
  houses?: unknown;
  ascendant?: unknown;

  dasha?: KundliDashaReport | null;

  yogas?: unknown;
  panchang?: unknown;
  shadbala?: unknown;
  ashtakavarga?: unknown;

  dosha?: {
    mangal?: unknown;
    manglik?: unknown;
    kaalSarp?: unknown;
    pitra?: unknown;
    papaSamaya?: unknown;
  } | null;

  extended?: {
    gemSuggestion?: unknown;
    sadeSati?: unknown;
    friendship?: unknown;
  };

  kp?: {
    houses?: unknown;
    planets?: unknown;
  };

  transit?: unknown;

  analysis?: {
    houses?: unknown;
    character?: unknown;
    career?: unknown;
    marriage?: unknown;
    finance?: unknown;
    health?: unknown;
    transit?: unknown;
    remedies?: unknown;
  };

  metadata?: unknown;
  providerPayload?: unknown;
}


