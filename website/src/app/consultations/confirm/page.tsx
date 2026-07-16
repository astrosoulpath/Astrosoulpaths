"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { BookingConfirmation } from "@/features/booking/BookingConfirmation";
import type { ConsultationMode } from "@/services/consultationService";

function parsePositiveNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function parsePositiveInteger(value: string | null) {
  const parsedValue = parsePositiveNumber(value);

  if (
    parsedValue === null ||
    !Number.isInteger(parsedValue)
  ) {
    return null;
  }

  return parsedValue;
}

function parseMode(value: string | null): ConsultationMode | null {
  if (value === "chat" || value === "audio") {
    return value;
  }

  return null;
}

export default function ConsultationConfirmationPage() {
  const searchParams = useSearchParams();

  const bookingDetails = useMemo(() => {
    const astrologerId =
      searchParams.get("astrologerId")?.trim() ?? "";

    const astrologerUserId =
      searchParams.get("astrologerUserId")?.trim() ?? "";

    const astrologerName =
      searchParams.get("astrologerName")?.trim() ||
      "Astrologer";

    const astrologerAvatarUrl =
      searchParams.get("astrologerAvatarUrl")?.trim() || null;

    const mode = parseMode(
      searchParams.get("mode"),
    );

    const minutes = parsePositiveInteger(
      searchParams.get("minutes"),
    );

    const pricePerMin = parsePositiveNumber(
      searchParams.get("pricePerMin"),
    );

    const returnPath =
      searchParams.get("returnPath")?.trim() ||
      (astrologerId
        ? `/astrologers/${encodeURIComponent(astrologerId)}`
        : "/astrologers");

    return {
      astrologerId,
      astrologerUserId,
      astrologerName,
      astrologerAvatarUrl,
      mode,
      minutes,
      pricePerMin,
      returnPath,
    };
  }, [searchParams]);

  const hasValidDetails =
    Boolean(bookingDetails.astrologerId) &&
    Boolean(bookingDetails.astrologerUserId) &&
    Boolean(bookingDetails.mode) &&
    bookingDetails.minutes !== null &&
    bookingDetails.minutes >= 1 &&
    bookingDetails.minutes <= 180 &&
    bookingDetails.pricePerMin !== null &&
    bookingDetails.pricePerMin > 0;

  if (!hasValidDetails) {
    return (
      <main className="min-h-[70vh] bg-[#F8F8F8] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl font-extrabold text-red-700">
            !
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-red-600">
            Booking Confirmation
          </p>

          <h1 className="mt-3 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
            Booking details are incomplete
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600">
            The consultation information is missing or invalid.
            Please return to the astrologer profile and select the
            consultation again.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/astrologers"
              className="rounded-xl bg-[#D4AF37] px-6 py-3 font-bold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Browse Astrologers
            </Link>

            <Link
              href="/consultations/current"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50"
            >
              Current Consultation
            </Link>

            <Link
              href="/consultations/history"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50"
            >
              Consultation History
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
            Consultation Checkout
          </p>

          <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
            Review and confirm
          </h1>

          <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
            Verify the astrologer, consultation mode, duration and
            payable amount before starting the session.
          </p>
        </div>

        <BookingConfirmation
          astrologerId={bookingDetails.astrologerId}
          astrologerUserId={
            bookingDetails.astrologerUserId
          }
          astrologerName={bookingDetails.astrologerName}
          astrologerAvatarUrl={
            bookingDetails.astrologerAvatarUrl
          }
          mode={bookingDetails.mode!}
          minutes={bookingDetails.minutes!}
          pricePerMin={bookingDetails.pricePerMin!}
          returnPath={bookingDetails.returnPath}
        />
      </div>
    </main>
  );
}