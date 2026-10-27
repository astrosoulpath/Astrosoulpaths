import { adminFetch } from "@/features/admin/auth/admin-session";

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

export async function getAdminStats() {
  const response = await adminFetch(`/admin/stats`, {
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load admin stats");
  }

  return data;
}

export async function getAdminAstrologers() {
  const response = await adminFetch(`/admin/astrologers`, {
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load astrologers");
  }

  return data;
}

export async function approveAstrologer(id: string) {
  const response = await adminFetch(`/admin/astrologers/${id}/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to approve astrologer");
  }

  return data;
}

export async function rejectAstrologer(id: string) {
  const response = await adminFetch(
    `/admin/astrologers/${id}/reject`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to reject astrologer");
  }

  return data;
}


export async function suspendAstrologer(id: string) {
  const response = await adminFetch(`/admin/astrologers/${id}/suspend`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Failed to suspend astrologer");
  }

  return data;
}