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

export async function registerAstrologer(payload: AstrologerRegistrationPayload) {
  const token = localStorage.getItem("asp_access_token");

  const response = await fetch(`${API_BASE_URL}/astrologer/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to register astrologer");
  }

  return data;
}