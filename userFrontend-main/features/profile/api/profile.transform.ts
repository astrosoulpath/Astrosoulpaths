import {
  BackendProfileGender,
  BackendProfilePayload,
  FrontendOnboardingPayload,
} from "./profile.types";

function zeroPad(value: number) {
  return value.toString().padStart(2, "0");
}

export function normalizeProfileDate(dateOfBirth: string) {
  const normalized = dateOfBirth.replace(/\s/g, "");
  const [day, month, year] = normalized.split("/").map(Number);

  if (!day || !month || !year) {
    return null;
  }

  return `${year}-${zeroPad(month)}-${zeroPad(day)}`;
}

export function normalizeProfileTime(timeOfBirth: string) {
  const match = timeOfBirth.match(/(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)/i);

  if (!match) {
    return null;
  }

  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  const normalizedHours = rawHours % 12;
  const hours = meridiem === "PM" ? normalizedHours + 12 : normalizedHours;

  return `${zeroPad(hours)}:${zeroPad(minutes)}:00`;
}

export function normalizeProfileGender(
  gender: FrontendOnboardingPayload["gender"],
): BackendProfileGender | null {
  if (gender === "male") {
    return "MALE";
  }

  if (gender === "female") {
    return "FEMALE";
  }

  return null;
}

export function validateOnboardingProfilePayload(
  payload: FrontendOnboardingPayload,
) {
  const missingFields: string[] = [];

  if (!payload.fullName.trim()) {
    missingFields.push("full name");
  }

  if (!normalizeProfileDate(payload.dateOfBirth)) {
    missingFields.push("date of birth");
  }

  if (!normalizeProfileTime(payload.timeOfBirth)) {
    missingFields.push("time of birth");
  }

  if (payload.latitude === null || payload.longitude === null) {
    missingFields.push("birthplace coordinates");
  }

  if (payload.utcCode === null) {
    missingFields.push("timezone");
  }

  if (!normalizeProfileGender(payload.gender)) {
    missingFields.push("gender");
  }

  if (!payload.birthPlace.trim()) {
    missingFields.push("location");
  }

  if (!payload.timeZone) {
    missingFields.push("timezone name");
  }

  if (!missingFields.length) {
    return null;
  }

  return `Missing required onboarding fields: ${missingFields.join(", ")}.`;
}

export function transformOnboardingProfilePayload(
  payload: FrontendOnboardingPayload,
): BackendProfilePayload {
  const normalizedDate = normalizeProfileDate(payload.dateOfBirth);
  const normalizedTime = normalizeProfileTime(payload.timeOfBirth);
  const normalizedGender = normalizeProfileGender(payload.gender);

  if (
    !normalizedDate ||
    !normalizedTime ||
    !normalizedGender ||
    payload.latitude === null ||
    payload.longitude === null ||
    payload.utcCode === null ||
    !payload.timeZone ||
    !payload.birthPlace.trim()
  ) {
    throw new Error(
      "Onboarding payload is incomplete and cannot be transformed.",
    );
  }

  return {
    fullName: payload.fullName.trim(),
    dateOfBirth: normalizedDate,
    timeOfBirth: normalizedTime,
    gender: normalizedGender,
    latitude: payload.latitude,
    longitude: payload.longitude,
    timezone: payload.utcCode,
    timezoneName: payload.timeZone,
    location: payload.birthPlace.trim(),
  };
}
