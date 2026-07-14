const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL!;

export type Review = {
  id: string;
  customerName: string;
  astrologerName: string;
  review: string;
  rating: number;
  createdAt: string;
};

export async function getHomepageReviews() {
  const response = await fetch(
    `${API_BASE_URL}/review/public`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load reviews.",
    );
  }

  return response.json();
}