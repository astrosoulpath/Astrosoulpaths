const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type AdminAstrologer = {
  id: string;
  userId: string;
  bio?: string | null;
  languages: string[];
  experience?: number | null;
  pricePerMin?: number | null;
  rating?: number | null;
  totalReviews: number;
  isApproved: boolean;
  isVerified: boolean;
  isOnline: boolean;
  createdAt: string;
  expertise?: {
    expertise?: {
      id: string;
      name: string;
    };
  }[];
};

function getAuthHeaders() {
  const token = localStorage.getItem("asp_access_token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getAdminStats() {
  const response = await fetch(`${API_BASE_URL}/admin/stats`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load admin stats");
  }

  return data;
}

export async function getAdminAstrologers() {
  const response = await fetch(`${API_BASE_URL}/admin/astrologers`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load astrologers");
  }

  return data;
}

export async function approveAstrologer(id: string) {
  const response = await fetch(`${API_BASE_URL}/admin/astrologers/${id}/approve`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to approve astrologer");
  }

  return data;
}

export async function suspendAstrologer(id: string) {
  const response = await fetch(`${API_BASE_URL}/admin/astrologers/${id}/suspend`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to suspend astrologer");
  }

  return data;
}