"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getConsultationHistory,
  type ConsultationSession,
} from "@/services/consultationService";

type FilterOption =
  | "all"
  | "active"
  | "completed";

function formatDate(value?: string | null): string {
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

function getDurationSeconds(
  consultation: ConsultationSession,
): number {
  const startTime = new Date(
    consultation.startedAt,
  ).getTime();

  const endTime = consultation.endedAt
    ? new Date(consultation.endedAt).getTime()
    : Date.now();

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((endTime - startTime) / 1000),
  );
}

function formatDuration(
  totalSeconds: number,
): string {
  const safeSeconds = Math.max(
    0,
    totalSeconds,
  );

  const hours = Math.floor(
    safeSeconds / 3600,
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );

  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(
      2,
      "0",
    )}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(
      2,
      "0",
    )}`;
  }

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}

function isActiveConsultation(
  consultation: ConsultationSession,
): boolean {
  if (
    consultation.status !== "ACTIVE" ||
    consultation.endedAt
  ) {
    return false;
  }

  const expiryTime = new Date(
    consultation.expiresAt,
  ).getTime();

  return (
    Number.isFinite(expiryTime) &&
    expiryTime > Date.now()
  );
}

function getStatusLabel(
  consultation: ConsultationSession,
): string {
  if (
    isActiveConsultation(consultation)
  ) {
    return "Active";
  }

  if (
    consultation.status === "EXPIRED"
  ) {
    return "Expired";
  }

  if (
    consultation.status === "ENDED"
  ) {
    return "Completed";
  }

  return consultation.status || "Completed";
}

export default function ConsultationsPage() {
  const router = useRouter();

  const [consultations, setConsultations] =
    useState<ConsultationSession[]>([]);

  const [filter, setFilter] =
    useState<FilterOption>("all");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadConsultations = useCallback(
    async (refresh = false) => {
      const token = localStorage.getItem(
        "asp_access_token",
      );

      if (!token) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            "/consultations",
          )}`,
        );

        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response =
          await getConsultationHistory();

        const calls =
          response.data?.calls ?? [];

        setConsultations(
          [...calls].sort(
            (first, second) =>
              new Date(
                second.createdAt,
              ).getTime() -
              new Date(
                first.createdAt,
              ).getTime(),
          ),
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load consultations.";

        if (message === "LOGIN_REQUIRED") {
          localStorage.removeItem(
            "asp_access_token",
          );

          localStorage.removeItem(
            "asp_refresh_token",
          );

          router.replace(
            `/login?redirect=${encodeURIComponent(
              "/consultations",
            )}`,
          );

          return;
        }

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadConsultations();
  }, [loadConsultations]);

  const filteredConsultations =
    useMemo(() => {
      if (filter === "all") {
        return consultations;
      }

      if (filter === "active") {
        return consultations.filter(
          isActiveConsultation,
        );
      }

      return consultations.filter(
        (consultation) =>
          !isActiveConsultation(
            consultation,
          ),
      );
    }, [consultations, filter]);

  const activeCount = useMemo(
    () =>
      consultations.filter(
        isActiveConsultation,
      ).length,
    [consultations],
  );

  const completedCount = useMemo(
    () =>
      consultations.filter(
        (consultation) =>
          !isActiveConsultation(
            consultation,
          ),
      ).length,
    [consultations],
  );

  const totalSpent = useMemo(
    () =>
      consultations.reduce(
        (total, consultation) =>
          total +
          (Number.isFinite(
            consultation.amountCharged,
          )
            ? consultation.amountCharged
            : 0),
        0,
      ),
    [consultations],
  );

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
              Review active and completed
              consultations stored securely in
              your Astro Soul Path account.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                loading || refreshing
              }
              onClick={() =>
                void loadConsultations(true)
              }
              className="rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <Link
              href="/astrologers"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Find Astrologers
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <h2 className="font-bold">
              Unable to load consultations
            </h2>

            <p className="mt-1 text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadConsultations()
              }
              className="mt-4 rounded-xl border border-red-300 px-5 py-2 font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Total Consultations
            </p>

            <p className="mt-2 text-3xl font-bold text-[#0B1026]">
              {consultations.length}
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
                Continue an active chat or
                review completed consultation
                details.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  [
                    "completed",
                    "Completed",
                  ],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(value)
                  }
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
            <div className="mt-8 space-y-5">
              {Array.from({
                length: 3,
              }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-2xl border border-gray-200 p-6"
                >
                  <div className="h-6 w-48 rounded bg-gray-200" />
                  <div className="mt-4 h-4 w-72 rounded bg-gray-200" />

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {Array.from({
                      length: 3,
                    }).map(
                      (_, itemIndex) => (
                        <div
                          key={
                            itemIndex
                          }
                          className="h-20 rounded-xl bg-gray-200"
                        />
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConsultations.length ===
            0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-[#FAF7F0] p-10 text-center">
              <h3 className="text-xl font-bold text-[#0B1026]">
                No consultations found
              </h3>

              <p className="mt-2 text-gray-600">
                Your active and completed
                consultations will appear here.
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
              {filteredConsultations.map(
                (consultation) => {
                  const active =
                    isActiveConsultation(
                      consultation,
                    );

                  const duration =
                    getDurationSeconds(
                      consultation,
                    );

                  const statusLabel =
                    getStatusLabel(
                      consultation,
                    );

                  return (
                    <article
                      key={consultation.id}
                      className="rounded-2xl border border-gray-200 p-6 transition hover:border-[#D4AF37] hover:shadow-md"
                    >
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-[#0B1026]">
                              {consultation.astrologerName ||
                                "Astro Soul Path Astrologer"}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                active
                                  ? "bg-green-100 text-green-700"
                                  : consultation.status ===
                                      "EXPIRED"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {
                                statusLabel
                              }
                            </span>

                            <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-bold text-[#0B1026]">
                              Chat Consultation
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-gray-500">
                            Started:{" "}
                            {formatDate(
                              consultation.startedAt,
                            )}
                          </p>

                          {consultation.endedAt && (
                            <p className="mt-1 text-sm text-gray-500">
                              Ended:{" "}
                              {formatDate(
                                consultation.endedAt,
                              )}
                            </p>
                          )}

                          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Price
                              </p>

                              <p className="mt-1 font-bold text-[#0B1026]">
                                ₹
                                {consultation.ratePerMinute.toFixed(
                                  2,
                                )}
                                /min
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Purchased
                              </p>

                              <p className="mt-1 font-bold text-[#0B1026]">
                                {
                                  consultation.totalMinutes
                                }{" "}
                                minutes
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Duration
                              </p>

                              <p className="mt-1 font-bold text-[#0B1026]">
                                {active
                                  ? "In progress"
                                  : formatDuration(
                                      duration,
                                    )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Charged
                              </p>

                              <p className="mt-1 font-bold text-[#D4AF37]">
                                ₹
                                {consultation.amountCharged.toFixed(
                                  2,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {active ? (
                            <Link
                              href={`/chat/${encodeURIComponent(
                                consultation.id,
                              )}`}
                              className="inline-flex w-full justify-center rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
                            >
                              Continue Chat
                            </Link>
                          ) : (
                            <Link
                              href="/astrologers"
                              className="inline-flex w-full justify-center rounded-xl border border-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#D4AF37]/10"
                            >
                              Book Again
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 border-t pt-4 text-xs text-gray-500">
                        Consultation ID:{" "}
                        {consultation.id}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}