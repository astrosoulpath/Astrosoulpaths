const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export async function sendOtp(phone: string) {
  const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: normalizePhone(phone),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to send OTP");
  }

  return data;
}

export async function verifyOtp(phone: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: normalizePhone(phone),
      token,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to verify OTP");
  }

  return data;
}