"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getHomepageReviews,
  type Review,
} from "@/services/reviewService";

export function ReviewSection() {
  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadReviews() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getHomepageReviews();

        setReviews(response.data ?? []);
      } catch (err) {
        setReviews([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load reviews.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadReviews();
  }, []);

  const averageRating =
    useMemo(() => {
      if (reviews.length === 0) {
        return "0.0";
      }

      const total =
        reviews.reduce(
          (sum, review) =>
            sum + review.rating,
          0,
        );

      return (
        total / reviews.length
      ).toFixed(1);
    }, [reviews]);

  if (loading) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-xl">
        <div className="animate-pulse">
          <div className="h-8 w-52 rounded bg-gray-200" />

          <div className="mt-8 space-y-6">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="rounded-3xl border p-6"
              >
                <div className="h-5 w-44 rounded bg-gray-200" />

                <div className="mt-4 h-4 w-full rounded bg-gray-200" />

                <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-2xl font-bold text-red-700">
            Unable to Load Reviews
          </h2>

          <p className="mt-3 text-red-600">
            {error}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-8 shadow-xl">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Customer Reviews
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#0B1026]">
            Ratings & Reviews
          </h2>
        </div>

        <div className="rounded-2xl bg-[#FAF7F0] px-6 py-4 text-center">
          <p className="text-3xl font-bold text-[#0B1026]">
            {averageRating}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {reviews.length} Verified Reviews
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#D4AF37]/15 text-5xl">
            ⭐
          </div>

          <h3 className="mt-6 text-2xl font-bold text-[#0B1026]">
            No Reviews Yet
          </h3>

          <p className="mt-4 text-gray-600">
            Verified customer reviews will appear automatically after completed consultations.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {reviews.map(
            (review) => (
              <article
                key={review.id}
                className="rounded-3xl border border-gray-100 bg-[#FAF7F0] p-6 transition hover:shadow-lg"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#0B1026]">
                      {review.customerName}
                    </h3>

                    <p className="text-sm text-gray-500">
                      {new Date(
                        review.createdAt,
                      ).toLocaleDateString()}
                    </p>

                    <p className="mt-1 text-sm text-[#D4AF37]">
                      Consultation with{" "}
                      {review.astrologerName}
                    </p>
                  </div>

                  <div className="rounded-full bg-[#D4AF37] px-4 py-2 font-semibold text-[#0B1026]">
                    ⭐{" "}
                    {review.rating.toFixed(
                      1,
                    )}
                  </div>
                </div>

                <p className="mt-5 leading-7 text-gray-700">
                  {review.review}
                </p>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}