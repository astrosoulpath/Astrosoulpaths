export type FrontendOnboardingPayload = {
  fullName: string;
  dateOfBirth: string;
  timeOfBirth: string;
  birthPlace: string;
  latitude: number | null;
  longitude: number | null;
  timeZone: string | null;
  timeCode: string | null;
  utcCode: number | null;
  utc: string | null;
  gender: "male" | "female" | "";
};

export type BackendProfileGender = "MALE" | "FEMALE";

export type BackendProfilePayload = {
  fullName: string;
  dateOfBirth: string;
  timeOfBirth: string;
  gender: BackendProfileGender;
  latitude: number;
  longitude: number;
  timezone: number;
  timezoneName: string;
  location: string;
};
