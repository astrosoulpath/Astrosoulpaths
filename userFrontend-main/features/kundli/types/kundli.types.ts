export type KundliGender = "male" | "female" | "other";

export type KundliStorageMode = "local" | "cloud";

export type KundliTab = "new" | "open";

export type KundliGeoFields = {
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: number;
  timezoneName?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  selectedGeo?: GeoSuggestion;
};

export type GeoSuggestion = {
  city: string;
  fullname?: string;
  state: string;
  countryCode: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: number;
  timezoneName: string;
};

export type KundliFormValues = {
  fullName: string;
  gender: KundliGender;
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: number;
  timezoneName?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  selectedGeo?: GeoSuggestion;
  notes?: string;
  saveMode: KundliStorageMode;
};

export type KundliSummary = {
  id: string;
  fullName: string;
  gender: KundliGender;
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  source: KundliStorageMode;
  createdAt: string;
};

export type CreateKundliRequest = KundliFormValues;

export type CreateKundliResponse = {
  kundli: KundliSummary;
};

export type OpenKundliFilter = {
  query?: string;
  source: KundliStorageMode;
};
