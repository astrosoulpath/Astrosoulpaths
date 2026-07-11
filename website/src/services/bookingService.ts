const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type ConsultationMode = "chat" | "audio";

export type CreateBookingPayload = {
  astrologerId: string;
  mode: ConsultationMode;
};

export type BookingResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id?: string;
    bookingId?: string;
    consultationId?: string;
    status?: string;
  };
};

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error("Booking can only be started from the browser.");
  }

  const token = localStorage.getItem("asp_access_token");

  if (!token) {
    throw new Error("LOGIN_REQUIRED");
  }

  return token;
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

export async function createConsultationBooking(
  payload: CreateBookingPayload,
): Promise<BookingResponse> {
  const astrologerId = payload.astrologerId.trim();

  if (!astrologerId) {
    throw new Error("Astrologer ID is required.");
  }

  if (!["chat", "audio"].includes(payload.mode)) {
    throw new Error("Invalid consultation mode.");
  }

  const token = getAccessToken();

  const response = await fetch(
    `${getApiBaseUrl()}/booking`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        astrologerId,
        mode: payload.mode,
      }),
    },
  );

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    if (response.status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }

    if (response.status === 402) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    throw new Error(
      message || "Unable to create consultation booking.",
    );
  }

  return data as BookingResponse;
}