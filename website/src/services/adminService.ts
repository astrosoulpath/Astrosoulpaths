const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function getAdminStats() {
  const token = localStorage.getItem("asp_access_token");

  const response = await fetch(`${API_BASE_URL}/admin/stats`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load admin stats");
  }

  return response.json();
}