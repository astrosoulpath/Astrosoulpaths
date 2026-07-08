const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type CreateAstroProfilePayload = {
  name: string;
  fullname?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  timezoneName?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  lang?: string;
  maritalStatus?: string;
  occupation?: string;
  avatarUrl?: string;
};

export async function saveAstroProfile(payload: CreateAstroProfilePayload) {
  const token = localStorage.getItem("asp_access_token");

  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to save profile");
  }

  return data;
}