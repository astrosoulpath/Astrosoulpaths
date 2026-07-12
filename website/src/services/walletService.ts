const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function getAccessToken() {
  return localStorage.getItem("asp_access_token");
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}

export async function getWallet() {
  return apiRequest("/wallet");
}

export async function getWalletHistory() {
  return apiRequest("/wallet/history");
}

export async function rechargeWallet(amount: number) {
  return apiRequest("/wallet/recharge", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}