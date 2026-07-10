const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type GenerateKundliPayload = {
  name?: string;
  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  lang?: string;
};

export async function generateKundli(payload: GenerateKundliPayload) {
  const response = await fetch(`${API_BASE_URL}/kundli/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to generate Kundli");
  }

  return data;
}