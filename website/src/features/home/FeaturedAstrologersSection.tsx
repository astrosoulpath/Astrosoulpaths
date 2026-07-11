"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AstrologerCard } from "@/features/astrologers/AstrologerCard";
import {
  getPublicAstrologers,
  PublicAstrologer,
} from "@/services/astrologerService";

export function FeaturedAstrologersSection() {
  const [astrologers, setAstrologers] = useState<PublicAstrologer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFeaturedAstrologers() {
      try {
        setLoading(true);
        setError("");

        const response = await getPublicAstrologers();

        setAstrologers(response.data.slice(0, 3));
      } catch (err: unknown) {
        setAstrologers([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load featured astrologers."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadFeaturedAstrologers();
  }, []);

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="font-semibold text-[#D4AF37]">
              Featured Astrologers
            </p>

            <h2 className="mt-2 text-4xl font-bold text-[#0B1026]">
              Connect With Verified Astrologers
            </h2>

            <p className="mt-3 max-w-2xl text-gray-600">
              Browse approved astrologers by expertise,
              language, experience, consultation fee and
              availability.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="inline-flex rounded-xl border border-[#0B1026] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
          >
            View All
          </Link>
        </div>

        {loading && (
          <div className="rounded-3xl bg-[#FAF7F0] p-10 text-center text-gray-600 shadow">
            Loading verified astrologers...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl bg-red-50 p-8 text-red-700 shadow">
            <h3 className="text-lg font-bold">
              Unable to load astrologers
            </h3>

            <p className="mt-2">{error}</p>
          </div>
        )}

        {!loading &&
          !error &&
          astrologers.length === 0 && (
            <div className="rounded-3xl border border-dashed bg-[#FAF7F0] p-10 text-center shadow">
              <h3 className="text-xl font-bold text-[#0B1026]">
                No verified astrologers available yet
              </h3>

              <p className="mt-3 text-gray-600">
                Approved astrologer profiles will appear
                here automatically.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          astrologers.length > 0 && (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {astrologers.map((astrologer) => (
                <AstrologerCard
                  key={astrologer.id}
                  id={astrologer.id}
                  name={
                    astrologer.name?.trim() ||
                    "Astro Soul Path Astrologer"
                  }
                  avatarUrl={astrologer.avatarUrl}
                  isOnline={astrologer.isOnline}
                  specialty={
                    astrologer.expertise.length
                      ? astrologer.expertise.join(", ")
                      : "Vedic Astrology"
                  }
                  experience={`${astrologer.experience} Years`}
                  languages={
                    astrologer.languages.length
                      ? astrologer.languages.join(", ")
                      : "Not specified"
                  }
                  price={`₹${astrologer.pricePerMin}/min`}
                  rating={astrologer.rating}
                />
              ))}
            </div>
          )}
      </div>
    </section>
  );
}