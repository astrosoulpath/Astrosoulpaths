"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ConsultationActions } from "@/features/booking/ConsultationActions";
import {
  getPublicAstrologerById,
  PublicAstrologerProfile as PublicAstrologerProfileType,
} from "@/services/astrologerService";

type AstrologerProfileProps = {
  astrologerId: string;
};

export function AstrologerProfile({
  astrologerId,
}: AstrologerProfileProps) {
  const [astrologer, setAstrologer] =
    useState<PublicAstrologerProfileType | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!astrologerId.trim()) {
      setAstrologer(null);
      setError("Invalid astrologer profile ID.");
      setLoading(false);
      return;
    }

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        setAstrologer(null);

        const response =
          await getPublicAstrologerById(astrologerId);

        setAstrologer(response.data);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load astrologer profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [astrologerId]);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
        Loading astrologer profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-red-50 p-8 text-red-700 shadow">
        <h2 className="text-xl font-bold">
          Unable to load astrologer profile
        </h2>

        <p className="mt-2">{error}</p>

        <Link
          href="/astrologers"
          className="mt-6 inline-block rounded-xl border border-red-300 px-5 py-3 font-semibold"
        >
          Back to Astrologers
        </Link>
      </div>
    );
  }

  if (!astrologer) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
        Astrologer profile not found.
      </div>
    );
  }

  const safeName =
    astrologer.name?.trim() || "Astro Soul Path Astrologer";

  const expertise = astrologer.expertise ?? [];
  const languages = astrologer.languages ?? [];

  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="shrink-0">
            {astrologer.avatarUrl ? (
              <Image
                src={astrologer.avatarUrl}
                alt={safeName}
                width={160}
                height={160}
                className="h-40 w-40 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-full bg-[#F5EED8] text-6xl font-bold text-[#0B1026]">
                {safeName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  astrologer.isOnline
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              />

              <span
                className={`font-semibold ${
                  astrologer.isOnline
                    ? "text-green-700"
                    : "text-gray-500"
                }`}
              >
                {astrologer.isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold text-[#0B1026]">
              {safeName}
            </h1>

            <p className="mt-2 text-lg text-[#D4AF37]">
              {expertise.length
                ? expertise.join(" • ")
                : "Vedic Astrology"}
            </p>

            <p className="mt-4 text-sm font-medium text-gray-500">
              {astrologer.availability}
            </p>

            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-[#FAF7F0] p-4">
                <p className="text-sm text-gray-500">
                  Experience
                </p>

                <p className="mt-1 font-bold">
                  {astrologer.experience} Years
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF7F0] p-4">
                <p className="text-sm text-gray-500">
                  Languages
                </p>

                <p className="mt-1 font-bold">
                  {languages.length
                    ? languages.join(", ")
                    : "Not specified"}
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF7F0] p-4">
                <p className="text-sm text-gray-500">
                  Rating
                </p>

                <p className="mt-1 font-bold">
                  {astrologer.rating > 0
                    ? `⭐ ${astrologer.rating.toFixed(1)} / 5`
                    : "New astrologer"}
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF7F0] p-4">
                <p className="text-sm text-gray-500">
                  Consultation Price
                </p>

                <p className="mt-1 font-bold text-[#D4AF37]">
                  ₹{astrologer.pricePerMin}/min
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-[#0B1026]">
                About
              </h2>

              <p className="mt-3 leading-7 text-gray-700">
                {astrologer.bio ||
                  "This astrologer has not added a detailed biography yet."}
              </p>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-[#0B1026]">
                Areas of Expertise
              </h2>

              <div className="mt-4 flex flex-wrap gap-3">
                {expertise.length ? (
                  expertise.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-[#F5EED8] px-4 py-2 text-sm font-semibold text-[#0B1026]"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">
                    Expertise not specified.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-[#0B1026]">
          Start a Consultation
        </h2>

        <p className="mt-2 text-gray-600">
          Select chat or audio call. Login status, astrologer
          availability and wallet balance will be checked before
          the consultation starts.
        </p>

        <div className="mt-6">
          <ConsultationActions
            astrologerId={astrologer.id}
            isOnline={astrologer.isOnline}
            chatEnabled={
              astrologer.consultationOptions.chat
            }
            audioEnabled={
              astrologer.consultationOptions.audioCall
            }
            pricePerMin={astrologer.pricePerMin}
          />
        </div>

        <Link
          href="/astrologers"
          className="mt-6 inline-block font-semibold text-[#0B1026] underline"
        >
          ← Back to all astrologers
        </Link>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-[#0B1026]">
          Reviews
        </h2>

        <p className="mt-4 text-gray-500">
          No verified customer reviews yet.
        </p>
      </div>
    </section>
  );
}