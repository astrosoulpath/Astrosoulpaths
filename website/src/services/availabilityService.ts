const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL!;

export type AvailabilityResponse = {
  success: boolean;
  message: string;

  data: {
    astrologerId: string;
    astrologerProfileId: string;

    astrologerName: string;

    avatarUrl: string | null;

    isOnline: boolean;

    responseTime: string | null;

    availabilityText: string;

    todaySchedule: {
      start: string;
      end: string;
      timezone: string;
    };

    weeklyAvailability: {
      day: string;
      available: boolean;
    }[];

    lastUpdated: string;
  };
};

export async function getAvailability(
  astrologerId: string,
): Promise<AvailabilityResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/availability/${encodeURIComponent(
        astrologerId,
      )}`,
      {
        cache: "no-store",
      },
    );

  if (!response.ok) {
    const error =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      error?.message ??
        "Unable to load availability.",
    );
  }

  return response.json();
}