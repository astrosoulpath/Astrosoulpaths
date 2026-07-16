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

const PAGE_SIZE = 10;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAstrologerName(
  consultation: ConsultationSession,
) {
  return (
    consultation.astrologer?.userProfile?.fullName ??
    "Astrologer"
  );
}

function getTotalMinutes(
  consultation: ConsultationSession,
) {
  return (
    consultation.purchasedMinutes +
    consultation.extendedMinutes
  );
}

function getStatusStyles(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ONGOING":
      return "bg-green-100 text-green-700";

    case "COMPLETED":
      return "bg-blue-100 text-blue-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    case "EXPIRED":
    case "ENDED":
      return "bg-gray-200 text-gray-700";

    default:
      return "bg-amber-100 text-amber-700";
  }
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to load consultation history.";
  }

  if (error.message === "LOGIN_REQUIRED") {
    return "Please log in to view your consultation history.";
  }

  return (
    error.message ||
    "Unable to load consultation history."
  );
}

export default function ConsultationHistoryPage() {
  const router = useRouter();

  const [consultations, setConsultations] = useState<
    ConsultationSession[]
  >([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const loadHistory = useCallback(
    async (
      requestedPage: number,
      showRefreshState = false,
    ) => {
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const response =
          await getConsultationHistory(
            requestedPage,
            PAGE_SIZE,
          );

        setConsultations(response.data);
        setPage(response.pagination.page);
        setTotalPages(
          Math.max(
            response.pagination.totalPages,
            1,
          ),
        );
        setTotal(response.pagination.total);
      } catch (error) {
        setConsultations([]);
        setErrorMessage(getErrorMessage(error));

        if (
          error instanceof Error &&
          error.message === "LOGIN_REQUIRED"
        ) {
          window.setTimeout(() => {
            router.push(
              `/login?redirect=${encodeURIComponent(
                "/consultations/history",
              )}`,
            );
          }, 900);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadHistory(page);
  }, [loadHistory, page]);

  const filteredConsultations = useMemo(() => {
    if (statusFilter === "ALL") {
      return consultations;
    }

    return consultations.filter(
      (consultation) =>
        consultation.status.toUpperCase() ===
        statusFilter,
    );
  }, [consultations, statusFilter]);

  const completedCount = useMemo(
    () =>
      consultations.filter(
        (item) =>
          item.status.toUpperCase() ===
          "COMPLETED",
      ).length,
    [consultations],
  );

  const activeCount = useMemo(
    () =>
      consultations.filter((item) =>
        ["ACTIVE", "ONGOING"].includes(
          item.status.toUpperCase(),
        ),
      ).length,
    [consultations],
  );

  const totalAmount = useMemo(
    () =>
      consultations.reduce(
        (sum, item) =>
          sum + Number(item.amountCharged ?? 0),
        0,
      ),
    [consultations],
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#F8F8F8] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="h-5 w-48 rounded bg-gray-200" />
            <div className="mt-4 h-10 w-80 rounded bg-gray-200" />

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-28 rounded-2xl bg-white"
                  />
                ),
              )}
            </div>

            <div className="mt-8 h-96 rounded-3xl bg-white" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Consultations
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Consultation History
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Review your previous and active
              consultations, session details,
              duration and charges.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/consultations/current"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 text-center font-bold text-[#0B1026] transition hover:bg-[#c69f2f]"
            >
              Current Consultation
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadHistory(page, true)
              }
              disabled={isRefreshing}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Unable to load consultation history
            </p>

            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Consultations
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {total}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Active Sessions
            </p>

            <p className="mt-3 text-3xl font-extrabold text-green-700">
              {activeCount}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Completed Sessions
            </p>

            <p className="mt-3 text-3xl font-extrabold text-blue-700">
              {completedCount}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Current Page Charges
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {formatCurrency(totalAmount)}
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                Session Records
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Showing page {page} of {totalPages}
              </p>
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0B1026] outline-none transition focus:border-[#D4AF37]"
            >
              <option value="ALL">
                All Statuses
              </option>
              <option value="ACTIVE">
                Active
              </option>
              <option value="ONGOING">
                Ongoing
              </option>
              <option value="COMPLETED">
                Completed
              </option>
              <option value="CANCELLED">
                Cancelled
              </option>
              <option value="ENDED">
                Ended
              </option>
              <option value="EXPIRED">
                Expired
              </option>
            </select>
          </div>

          {filteredConsultations.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">
                ✦
              </div>

              <h3 className="mt-5 text-2xl font-extrabold text-[#0B1026]">
                No consultations found
              </h3>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600">
                No consultation records match the
                selected status.
              </p>

              <Link
                href="/astrologers"
                className="mt-6 inline-block rounded-xl bg-[#D4AF37] px-6 py-3 font-bold text-[#0B1026]"
              >
                Browse Astrologers
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredConsultations.map(
                (consultation) => {
                  const totalMinutes =
                    getTotalMinutes(consultation);

                  const isActive = [
                    "ACTIVE",
                    "ONGOING",
                  ].includes(
                    consultation.status.toUpperCase(),
                  );

                  return (
                    <article
                      key={consultation.id}
                      className="rounded-2xl border border-gray-200 p-5 transition hover:border-[#D4AF37] hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-extrabold text-[#0B1026]">
                              {getAstrologerName(
                                consultation,
                              )}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusStyles(
                                consultation.status,
                              )}`}
                            >
                              {consultation.status}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <p className="font-semibold text-gray-500">
                                Started
                              </p>
                              <p className="mt-1 font-bold text-[#0B1026]">
                                {formatDateTime(
                                  consultation.startedAt,
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold text-gray-500">
                                Duration
                              </p>
                              <p className="mt-1 font-bold text-[#0B1026]">
                                {totalMinutes} minutes
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold text-gray-500">
                                Rate
                              </p>
                              <p className="mt-1 font-bold text-[#0B1026]">
                                {formatCurrency(
                                  consultation.ratePerMinute,
                                )}
                                /min
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold text-gray-500">
                                Amount
                              </p>
                              <p className="mt-1 font-bold text-[#0B1026]">
                                {formatCurrency(
                                  consultation.amountCharged,
                                )}
                              </p>
                            </div>
                          </div>

                          <p className="mt-4 break-all text-xs text-gray-500">
                            Consultation ID:{" "}
                            {consultation.id}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                          {isActive ? (
                            <Link
                              href="/consultations/current"
                              className="rounded-xl bg-[#D4AF37] px-5 py-3 text-center text-sm font-bold text-[#0B1026] transition hover:bg-[#c69f2f]"
                            >
                              Resume
                            </Link>
                          ) : null}

                          <Link
                            href={`/consultations/${encodeURIComponent(
                              consultation.id,
                            )}`}
                            className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-center text-sm font-bold text-[#0B1026] transition hover:bg-gray-50"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.max(current - 1, 1),
                  )
                }
                disabled={page <= 1}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-[#0B1026] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      current + 1,
                      totalPages,
                    ),
                  )
                }
                disabled={page >= totalPages}
                className="rounded-xl bg-[#0B1026] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#171d39] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}