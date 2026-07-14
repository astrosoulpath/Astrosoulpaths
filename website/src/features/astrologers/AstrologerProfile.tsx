"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { ConsultationActions } from "@/features/booking/ConsultationActions";
import {
  getPublicAstrologerById,
  type PublicAstrologerProfile as PublicAstrologerProfileType,
} from "@/services/astrologerService";

import { AvailabilityCard } from "./AvailabilityCard";
import { ReviewSection } from "./ReviewSection";

type AstrologerProfileProps = {
  astrologerId: string;
};

type CallableAstrologerProfile =
  PublicAstrologerProfileType & {
    userId?: string | null;
    astrologerUserId?: string | null;
    totalConsultations?: number | null;
  };

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Failed to load astrologer profile.";
}

function getSafeNumber(
  value: unknown,
  fallback = 0,
): number {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue,
  )
    ? numberValue
    : fallback;
}

function getStringList(
  values: unknown,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) =>
      item.trim(),
    )
    .filter(Boolean);
}

export function AstrologerProfile({
  astrologerId,
}: AstrologerProfileProps) {
  const [
    astrologer,
    setAstrologer,
  ] =
    useState<CallableAstrologerProfile | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const normalizedAstrologerId =
    astrologerId?.trim();

  useEffect(() => {
    let cancelled = false;

    if (!normalizedAstrologerId) {
      setAstrologer(null);
      setError(
        "Invalid astrologer profile ID.",
      );
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        setAstrologer(null);

        const response =
          await getPublicAstrologerById(
            normalizedAstrologerId,
          );

        if (cancelled) {
          return;
        }

        if (!response?.data) {
          throw new Error(
            "Astrologer profile was not found.",
          );
        }

        setAstrologer(
          response.data as CallableAstrologerProfile,
        );
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setError(
          getErrorMessage(error),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [normalizedAstrologerId]);

  const safeName =
    astrologer?.name?.trim() ||
    "Astro Soul Path Astrologer";

  const expertise =
    useMemo(
      () =>
        getStringList(
          astrologer?.expertise,
        ),
      [astrologer?.expertise],
    );

  const languages =
    useMemo(
      () =>
        getStringList(
          astrologer?.languages,
        ),
      [astrologer?.languages],
    );

  if (loading) {
    return (
      <section
        className="space-y-8"
        aria-busy="true"
        aria-label="Loading astrologer profile"
      >
        <div className="animate-pulse rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="h-40 w-40 shrink-0 rounded-full bg-gray-200" />

            <div className="flex-1">
              <div className="h-10 w-64 max-w-full rounded bg-gray-200" />

              <div className="mt-4 h-5 w-48 rounded bg-gray-200" />

              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(
                  (item) => (
                    <div
                      key={item}
                      className="h-24 rounded-xl bg-gray-100"
                    />
                  ),
                )}
              </div>

              <div className="mt-8 h-24 rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-3xl bg-white shadow-lg" />

          <div className="h-96 animate-pulse rounded-3xl bg-white shadow-lg" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow"
      >
        <h2 className="text-xl font-bold">
          Unable to load astrologer profile
        </h2>

        <p className="mt-2">
          {error}
        </p>

        <Link
          href="/astrologers"
          className="mt-6 inline-flex rounded-xl border border-red-300 px-5 py-3 font-semibold transition hover:bg-red-100"
        >
          Back to Astrologers
        </Link>
      </div>
    );
  }

  if (!astrologer) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
        <h2 className="text-xl font-bold text-[#0B1026]">
          Astrologer profile not found
        </h2>

        <p className="mt-2 text-gray-600">
          The requested astrologer profile is unavailable.
        </p>

        <Link
          href="/astrologers"
          className="mt-5 inline-flex font-semibold text-[#0B1026] underline underline-offset-4"
        >
          Back to Astrologers
        </Link>
      </div>
    );
  }

  const astrologerUserId =
    astrologer.userId?.trim() ||
    astrologer.astrologerUserId?.trim() ||
    "";

  const experience =
    Math.max(
      0,
      getSafeNumber(
        astrologer.experience,
      ),
    );

  const rating =
    Math.max(
      0,
      Math.min(
        5,
        getSafeNumber(
          astrologer.rating,
        ),
      ),
    );

  const pricePerMin =
    Math.max(
      0,
      getSafeNumber(
        astrologer.pricePerMin,
      ),
    );

  const totalConsultations =
    Math.max(
      0,
      Math.floor(
        getSafeNumber(
          astrologer.totalConsultations,
        ),
      ),
    );

  const isOnline =
    Boolean(
      astrologer.isOnline,
    );

  const consultationOptions =
    astrologer.consultationOptions ?? {
      chat: false,
      audioCall: false,
      videoCall: false,
    };

  const availabilityText =
    astrologer.availability?.trim() ||
    (isOnline
      ? "Available for consultation"
      : "Currently unavailable");

  return (
    <section className="space-y-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
        <div className="h-28 bg-gradient-to-r from-[#0B1026] via-[#171D3D] to-[#D4AF37]" />

        <div className="-mt-20 p-6 sm:p-8">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="shrink-0">
              <div className="rounded-full bg-white p-2 shadow-xl">
                {astrologer.avatarUrl ? (
                  <Image
                    src={
                      astrologer.avatarUrl
                    }
                    alt={`${safeName} profile`}
                    width={160}
                    height={160}
                    priority
                    className="h-40 w-40 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-full bg-[#F5EED8] text-6xl font-bold text-[#0B1026]">
                    {safeName
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    isOnline
                      ? "animate-pulse bg-green-500"
                      : "bg-gray-400"
                  }`}
                  aria-hidden="true"
                />

                <span
                  className={`font-semibold ${
                    isOnline
                      ? "text-green-700"
                      : "text-gray-500"
                  }`}
                >
                  {isOnline
                    ? "Online"
                    : "Offline"}
                </span>
              </div>
            </div>

            <div className="flex-1 pt-2 md:pt-20">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-[#0B1026] sm:text-4xl">
                      {safeName}
                    </h1>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      ✓ Verified
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-medium text-[#B18D19]">
                    {expertise.length
                      ? expertise.join(
                          " • ",
                        )
                      : "Vedic Astrology"}
                  </p>

                  <p className="mt-3 text-sm font-medium text-gray-500">
                    {availabilityText}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FAF7F0] px-4 py-3 text-center">
                  <p className="text-xl font-bold text-[#0B1026]">
                    {rating > 0
                      ? `⭐ ${rating.toFixed(
                          1,
                        )}`
                      : "New"}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {rating > 0
                      ? "Verified rating"
                      : "New astrologer"}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-[#FAF7F0] p-4">
                  <p className="text-sm text-gray-500">
                    Experience
                  </p>

                  <p className="mt-1 font-bold text-[#0B1026]">
                    {experience > 0
                      ? `${experience} Years`
                      : "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#FAF7F0] p-4">
                  <p className="text-sm text-gray-500">
                    Languages
                  </p>

                  <p className="mt-1 font-bold text-[#0B1026]">
                    {languages.length
                      ? languages.join(
                          ", ",
                        )
                      : "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#FAF7F0] p-4">
                  <p className="text-sm text-gray-500">
                    Rating
                  </p>

                  <p className="mt-1 font-bold text-[#0B1026]">
                    {rating > 0
                      ? `⭐ ${rating.toFixed(
                          1,
                        )} / 5`
                      : "New astrologer"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#0B1026] p-4 text-white">
                  <p className="text-sm text-white/60">
                    Consultation Price
                  </p>

                  <p className="mt-1 font-bold text-[#D4AF37]">
                    ₹
                    {pricePerMin.toFixed(
                      2,
                    )}
                    /min
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-bold text-[#0B1026]">
                  About
                </h2>

                <p className="mt-3 leading-7 text-gray-700">
                  {astrologer.bio?.trim() ||
                    "This astrologer has not added a detailed biography yet."}
                </p>
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-bold text-[#0B1026]">
                  Areas of Expertise
                </h2>

                <div className="mt-4 flex flex-wrap gap-3">
                  {expertise.length ? (
                    expertise.map(
                      (item) => (
                        <span
                          key={item}
                          className="rounded-full bg-[#F5EED8] px-4 py-2 text-sm font-semibold text-[#0B1026]"
                        >
                          {item}
                        </span>
                      ),
                    )
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
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
              Live Consultation
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#0B1026] sm:text-3xl">
              Start a Consultation
            </h2>

            <p className="mt-2 max-w-3xl leading-7 text-gray-600">
              Select chat or audio call. Login, astrologer
              availability, wallet balance and call-server
              connection will be checked before the consultation
              begins.
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${
              isOnline
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {isOnline
              ? "Available Now"
              : "Currently Offline"}
          </span>
        </div>

        {!astrologerUserId &&
          consultationOptions.audioCall && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
            >
              Audio calling is temporarily unavailable because this
              astrologer&apos;s call account has not been linked by
              the backend.
            </div>
          )}

        <div className="mt-6">
          <ConsultationActions
            astrologerId={
              astrologer.id
            }
            astrologerUserId={
              astrologerUserId ||
              undefined
            }
            astrologerName={
              safeName
            }
            isOnline={
              isOnline
            }
            chatEnabled={Boolean(
              consultationOptions.chat,
            )}
            audioEnabled={Boolean(
              consultationOptions.audioCall &&
                astrologerUserId,
            )}
            pricePerMin={
              pricePerMin
            }
          />
        </div>

        <Link
          href="/astrologers"
          className="mt-6 inline-flex font-semibold text-[#0B1026] underline underline-offset-4"
        >
          ← Back to all astrologers
        </Link>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <AvailabilityCard
          astrologerId={
            astrologer.id
          }
          totalConsultations={
            totalConsultations
          }
        />

        <ReviewSection />
      </div>
    </section>
  );
}