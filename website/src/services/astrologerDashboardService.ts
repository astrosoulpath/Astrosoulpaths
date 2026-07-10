const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type AstrologerDashboardData = {
  astrologerId: string;
  earnings: number;
  todayCalls: number;
  todayChats: number;
  rating: number;
  isOnline: boolean;
  isApproved: boolean;
  isVerified: boolean;
  profileCompletion: number;
  pendingConsultations: number;
  todaySchedule: any[];
  languages: string[];
  expertise: string[];
  pricePerMin: number;
  experience: number;
};

function getAuthHeaders() {
  const token = localStorage.getItem("asp_access_token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getAstrologerDashboard() {
  const response = await fetch(`${API_BASE_URL}/astrologer/dashboard`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load astrologer dashboard");
  }

  return data;
}

export async function updateAstrologerStatus(isOnline: boolean) {
  const response = await fetch(`${API_BASE_URL}/astrologer/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isOnline }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to update availability");
  }

  return data;
}