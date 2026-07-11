"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ConsultationMode = "chat" | "audio";
type ConsultationStatus = "active" | "completed";

type LocalBooking = {
  id: string;
  astrologerId: string;
  astrologerName?: string;
  mode: ConsultationMode;
  pricePerMin: number;
  status: ConsultationStatus;
  createdAt: string;
  endedAt?: string;
  durationSeconds?: number;
  billedMinutes?: number;
  totalCharge?: number;
};

type FilterOption = "all" | "active" | "completed";

function readConsultationBookings(): LocalBooking[] {
  const storedBookings = localStorage.getItem(
    "asp_consultation_bookings",
  );

  if (!storedBookings) {
    return [];
  }

  try {
    const parsedBookings = JSON.parse(
      storedBookings,
    ) as LocalBooking[];

    if (!Array.isArray(parsedBookings)) {
      return [];
    }

    return parsedBookings
      .filter(
        (booking) =>
          typeof booking.id === "string" &&
          typeof booking.astrologerId === "string",
      )
      .sort((first, second) => {
        return (
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
        );
      });
  } catch {
    localStorage.removeItem("asp_consultation_bookings");
    return [];
  }
}

function formatDuration(totalSeconds = 0): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function formatDate(value?: string): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ConsultationsPage() {
  const [bookings, setBookings] = useState<LocalBooking[]>(
    [],
  );
  const [filter, setFilter] =
    useState<FilterOption>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBookings(readConsultationBookings());
    setLoading(false);
  }, []);

  const filteredBookings = useMemo(() => {
    if (filter === "all") {
      return bookings;
    }

    return bookings.filter(
      (booking) => booking.status === filter,
    );
  }, [bookings, filter]);

  const activeCount = useMemo(
    () =>
      bookings.filter(
        (booking) => booking.status === "active",
      ).length,
    [bookings],
  );

  const completedCount = useMemo(
    () =>
      bookings.filter(
        (booking) => booking.status === "completed",
      ).length,
    [bookings],
  );

  const totalSpent = useMemo(
    () =>
      bookings.reduce(
        (total, booking) =>
          total +
          (typeof booking.totalCharge === "number"
            ? booking.totalCharge
            : 0),
        0,
      ),
    [bookings],
  );

  function refreshBookings() {
    setBookings(readConsultationBookings());
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-semibold text-[#D4AF37]">
              My Consultations
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#0B1026] sm:text-5xl">
              Consultation history
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-gray-600">
              Review active and completed chat or audio-call
              consultations with your astrologers.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshBookings}
              className="rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
            >
              Refresh
            </button>

            <Link
              href="/astrologers"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Find Astrologers
            </Link>
          </div>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Total Consultations
            </p>

            <p className="mt-2 text-3xl font-bold text-[#0B1026]">
              {bookings.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Active
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Completed
            </p>

            <p className="mt-2 text-3xl font-bold text-[#0B1026]">
              {completedCount}
            </p>
          </div>

          <div className="rounded-3xl bg-[#0B1026] p-6 text-white shadow-lg">
            <p className="text-sm font-medium text-gray-300">
              Total Spent
            </p>

            <p className="mt-2 text-3xl font-bold text-[#D4AF37]">
              ₹{totalSpent.toFixed(2)}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-lg sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#0B1026]">
                Consultation records
              </h2>

              <p className="mt-1 text-gray-600">
                Continue an active consultation or review completed
                session details.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["completed", "Completed"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                    filter === value
                      ? "bg-[#0B1026] text-white"
                      : "bg-[#FAF7F0] text-[#0B1026] hover:bg-[#D4AF37]/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl bg-[#FAF7F0] p-10 text-center text-gray-600">
              Loading consultations...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-[#FAF7F0] p-10 text-center">
              <h3 className="text-xl font-bold text-[#0B1026]">
                No consultations found
              </h3>

              <p className="mt-2 text-gray-600">
                Your active and completed consultations will appear
                here.
              </p>

              <Link
                href="/astrologers"
                className="mt-6 inline-flex rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026]"
              >
                Browse Astrologers
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              {filteredBookings.map((booking) => {
                const isActive =
                  booking.status === "active";

                const modeLabel =
                  booking.mode === "chat"
                    ? "Chat Consultation"
                    : "Audio Call";

                return (
                  <article
                    key={booking.id}
                    className="rounded-2xl border border-gray-200 p-6 transition hover:border-[#D4AF37] hover:shadow-md"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold text-[#0B1026]">
                            {booking.astrologerName ||
                              "Astro Soul Path Astrologer"}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {isActive
                              ? "Active"
                              : "Completed"}
                          </span>

                          <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-bold text-[#0B1026]">
                            {modeLabel}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-gray-500">
                          Started: {formatDate(booking.createdAt)}
                        </p>

                        {booking.endedAt && (
                          <p className="mt-1 text-sm text-gray-500">
                            Ended: {formatDate(booking.endedAt)}
                          </p>
                        )}

                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                          <div className="rounded-xl bg-[#FAF7F0] p-4">
                            <p className="text-xs font-medium text-gray-500">
                              Price
                            </p>

                            <p className="mt-1 font-bold text-[#0B1026]">
                              ₹{booking.pricePerMin}/min
                            </p>
                          </div>

                          <div className="rounded-xl bg-[#FAF7F0] p-4">
                            <p className="text-xs font-medium text-gray-500">
                              Duration
                            </p>

                            <p className="mt-1 font-bold text-[#0B1026]">
                              {isActive
                                ? "In progress"
                                : formatDuration(
                                    booking.durationSeconds,
                                  )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-[#FAF7F0] p-4">
                            <p className="text-xs font-medium text-gray-500">
                              Charged
                            </p>

                            <p className="mt-1 font-bold text-[#D4AF37]">
                              {isActive
                                ? "Pending"
                                : `₹${(
                                    booking.totalCharge ?? 0
                                  ).toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isActive &&
                        booking.mode === "chat" ? (
                          <Link
                            href={`/chat/${encodeURIComponent(
                              booking.id,
                            )}`}
                            className="inline-flex w-full justify-center rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
                          >
                            Continue Chat
                          </Link>
                        ) : isActive &&
                          booking.mode === "audio" ? (
                          <button
                            type="button"
                            disabled
                            className="w-full cursor-not-allowed rounded-xl bg-gray-200 px-6 py-3 font-semibold text-gray-500"
                          >
                            Audio Screen Pending
                          </button>
                        ) : (
                          <Link
                            href={`/astrologers/${encodeURIComponent(
                              booking.astrologerId,
                            )}`}
                            className="inline-flex w-full justify-center rounded-xl border border-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#D4AF37]/10"
                          >
                            View Astrologer
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}