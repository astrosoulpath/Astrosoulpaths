"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AstrologerCard } from "@/features/astrologers/AstrologerCard";
import {
  getPublicAstrologers,
  type PublicAstrologer,
} from "@/services/astrologerService";

const FEATURED_LIMIT = 3;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Failed to load featured astrologers.";
}

export function FeaturedAstrologersSection() {
  const [astrologers, setAstrologers] = useState<PublicAstrologer[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadFeaturedAstrologers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getPublicAstrologers({
        online: true,
      });

      const featured = response.data
        .filter((astrologer) => Boolean(astrologer.id))
        .sort((first, second) => {
          if (first.isOnline !== second.isOnline) {
            return first.isOnline ? -1 : 1;
          }

          return second.rating - first.rating;
        })
        .slice(0, FEATURED_LIMIT);

      setAstrologers(featured);
    } catch (error: unknown) {
      setAstrologers([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeaturedAstrologers();
  }, [loadFeaturedAstrologers]);

  return (
    <section className="relative overflow-hidden bg-white py-24 sm:py-28">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col justify-between gap-7 md:mb-14 md:flex-row md:items-end">
          <div>
            <p className="inline-flex rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#A47B12]">
              Featured Astrologers
            </p>

            <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.045em] text-[#08142E] sm:text-4xl lg:text-5xl">
              Connect With Verified Astrologers
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-[#667085]">
              Browse approved astrologers by expertise, language, experience,
              consultation fee and live availability.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="inline-flex w-fit items-center justify-center rounded-2xl border border-[#CCD2DD] bg-white px-6 py-3.5 text-sm font-black text-[#0B1739] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/15"
          >
            View All Astrologers
          </Link>
        </div>

        {loading && (
          <div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading featured astrologers"
          >
            {Array.from({
              length: FEATURED_LIMIT,
            }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-[1.75rem] border border-[#ECE7DD] bg-white p-6 shadow-[0_16px_40px_rgba(10,22,52,.07)]"
              >
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-gray-200" />

                  <div className="flex-1">
                    <div className="h-5 w-40 rounded bg-gray-200" />
                    <div className="mt-3 h-4 w-28 rounded bg-gray-100" />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="h-4 rounded bg-gray-100" />
                  <div className="h-4 w-4/5 rounded bg-gray-100" />
                  <div className="h-12 rounded-xl bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-[1.75rem] border border-red-200 bg-red-50/80 p-8 text-red-700 shadow-[0_12px_35px_rgba(10,22,52,.06)]"
          >
            <h3 className="text-lg font-bold">Unable to load astrologers</h3>

            <p className="mt-2">{error}</p>

            <button
              type="button"
              onClick={() => void loadFeaturedAstrologers()}
              className="mt-5 rounded-xl border border-red-300 px-5 py-2.5 font-semibold transition hover:bg-red-100"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && astrologers.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-[#D4AF37]/45 bg-gradient-to-br from-[#FFFCF5] to-[#FAF5E8] p-12 text-center shadow-[0_16px_45px_rgba(10,22,52,.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37]/15 text-3xl">
              âœ¨
            </div>

            <h3 className="mt-5 text-xl font-bold text-[#0B1026]">
              No online astrologers available yet
            </h3>

            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              Approved and verified astrologers will appear here automatically
              when they go online.
            </p>

            <Link
              href="/astrologers"
              className="mt-6 inline-flex rounded-xl bg-[#0B1026] px-6 py-3 font-semibold text-white transition hover:bg-[#171D3D]"
            >
              Browse All Profiles
            </Link>
          </div>
        )}

        {!loading && !error && astrologers.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {astrologers.map((astrologer) => {
              const safeExperience = Number.isFinite(astrologer.experience)
                ? Math.max(0, astrologer.experience)
                : 0;

              const safePrice = Number.isFinite(astrologer.pricePerMin)
                ? Math.max(0, astrologer.pricePerMin)
                : 0;

              return (
                <AstrologerCard
                  key={astrologer.id}
                  id={astrologer.id}
                  name={astrologer.name?.trim() || "Astro Soul Path Astrologer"}
                  avatarUrl={astrologer.avatarUrl}
                  isOnline={astrologer.isOnline}
                  specialty={
                    astrologer.expertise.length
                      ? astrologer.expertise.join(", ")
                      : "Vedic Astrology"
                  }
                  experience={
                    safeExperience > 0
                      ? `${safeExperience} Years`
                      : "Experience not specified"
                  }
                  languages={
                    astrologer.languages.length
                      ? astrologer.languages.join(", ")
                      : "Not specified"
                  }
                  price={`â‚¹${safePrice.toFixed(2)}/min`}
                  rating={astrologer.rating}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
