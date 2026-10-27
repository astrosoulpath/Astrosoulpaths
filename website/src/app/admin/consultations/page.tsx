"use client";

import { adminFetch } from "@/features/admin/auth/admin-session";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ADMIN_CONSULTATION_MUTATIONS_AVAILABLE = false;

type ConsultationStatus =
  | "ACTIVE"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED"
  | "ENDED"
  | "EXPIRED"
  | string;

type ConsultationUserProfile = {
  fullName?: string | null;
  avatarUrl?: string | null;
};

type ConsultationParticipant = {
  id?: string;
  email?: string | null;
  phone?: string | null;
  userProfile?: ConsultationUserProfile | null;
};

type AdminConsultation = {
  id: string;
  userId: string;
  astrologerId: string;
  channelName: string;
  ratePerMinute: number;
  purchasedMinutes: number;
  extendedMinutes: number;
  amountCharged: number;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  status: ConsultationStatus;
  createdAt?: string;

  user?: ConsultationParticipant | null;
  astrologer?: ConsultationParticipant | null;

  earning?: {
    grossAmount?: number | string | null;
    platformFee?: number | string | null;
    netAmount?: number | string | null;
    currency?: string | null;
    status?: string | null;
  } | null;

  _count?: {
    messages?: number;
  };
};

type AdminConsultationsResponse = {
  success: boolean;
  pagination?: { totalPages?: number };
  message?: string;
  data:
    | AdminConsultation[]
    | {
        consultations?: AdminConsultation[];
        calls?: AdminConsultation[];
        items?: AdminConsultation[];
        total?: number;
      };
};

type StatusFilter =
  | "ALL"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";



function getSafeNumber(value: unknown) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(
  value: unknown,
  currency = "INR",
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(getSafeNumber(value));
}

function formatDateTime(value?: string | null) {
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

function getParticipantName(
  participant?: ConsultationParticipant | null,
  fallback = "Unknown user",
) {
  return (
    participant?.userProfile?.fullName?.trim() ||
    participant?.email?.trim() ||
    participant?.phone?.trim() ||
    fallback
  );
}

function getStatusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ONGOING":
      return "Active";

    case "COMPLETED":
      return "Completed";

    case "CANCELLED":
      return "Cancelled";

    case "ENDED":
      return "Ended";

    case "EXPIRED":
      return "Expired";

    default:
      return status || "Unknown";
  }
}

function getStatusClasses(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ONGOING":
      return "border-green-200 bg-green-100 text-green-700";

    case "COMPLETED":
      return "border-blue-200 bg-blue-100 text-blue-700";

    case "CANCELLED":
      return "border-red-200 bg-red-100 text-red-700";

    case "ENDED":
    case "EXPIRED":
      return "border-gray-200 bg-gray-200 text-[#263A55]";

    default:
      return "border-amber-200 bg-amber-100 text-amber-700";
  }
}

function getErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Unable to load consultations.";
}

function normalizeConsultations(
  response: AdminConsultationsResponse | null,
): AdminConsultation[] {
  if (!response) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  const possibleItems =
    response.data.consultations ??
    response.data.calls ??
    response.data.items;

  return Array.isArray(possibleItems)
    ? possibleItems
    : [];
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export default function AdminConsultationsPage() {
  const [consultations, setConsultations] = useState<
    AdminConsultation[]
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [updatingId, setUpdatingId] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestVersion = useRef(0);

  const loadConsultations = useCallback(
    async (showRefreshState = false) => {
      const version = ++requestVersion.current;
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const response = await adminFetch(
          `/admin/consultations?${new URLSearchParams({page: String(page), limit: "20", search, status: statusFilter})}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          },
        );

        const data =
          (await readJson(
            response,
          )) as AdminConsultationsResponse | null;

        if (version !== requestVersion.current) return;
        if (!response.ok) {
          const rawMessage = (
            data as {
              message?: string | string[];
            } | null
          )?.message;

          const message = Array.isArray(rawMessage)
            ? rawMessage.join(", ")
            : rawMessage;

          throw new Error(
            message ||
              `Unable to load consultations (${response.status}).`,
          );
        }

        setConsultations(normalizeConsultations(data));
        setTotalPages(Math.max(1, data?.pagination?.totalPages ?? 1));
      } catch (error) {
        if (version !== requestVersion.current) return;
        setConsultations([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (version === requestVersion.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, search, statusFilter],
  );

  useEffect(() => {
    const lifetime = requestVersion;
    const timer = setTimeout(() => { void loadConsultations(); }, 250);
    return () => { clearTimeout(timer); lifetime.current++; };
  }, [loadConsultations]);

  const filteredConsultations = consultations;

  const stats = useMemo(() => {
    const active = consultations.filter((item) =>
      ["ACTIVE", "ONGOING"].includes(
        item.status.toUpperCase(),
      ),
    ).length;

    const completed = consultations.filter(
      (item) =>
        item.status.toUpperCase() === "COMPLETED",
    ).length;

    const cancelled = consultations.filter(
      (item) =>
        item.status.toUpperCase() === "CANCELLED",
    ).length;



    return {
      total: consultations.length,
      active,
      completed,
      cancelled,

    };
  }, [consultations]);

  async function updateConsultationStatus(
    consultationId: string,
    action: "complete" | "cancel",
  ) {
    if (!ADMIN_CONSULTATION_MUTATIONS_AVAILABLE) {
      setErrorMessage("Admin completion and cancellation are currently unavailable.");
      return;
    }
    try {
      setUpdatingId(consultationId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await adminFetch(
        `/admin/consultations/${encodeURIComponent(
          consultationId,
        )}/${action}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await readJson(response);

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(", ")
          : data?.message;

        throw new Error(
          message ||
            `Unable to ${action} consultation.`,
        );
      }

      setConsultations((current) =>
        current.map((item) => {
          if (item.id !== consultationId) {
            return item;
          }

          return {
            ...item,
            status:
              action === "complete"
                ? "COMPLETED"
                : "CANCELLED",
            endedAt: new Date().toISOString(),
          };
        }),
      );

      setSuccessMessage(
        action === "complete"
          ? "Consultation completed successfully."
          : "Consultation cancelled successfully.",
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="asp-admin-title mt-2 text-3xl sm:text-4xl">
              Consultation Management
            </h1>

            <p className="asp-admin-subtitle mt-3 max-w-3xl text-base">
              Monitor active consultations, completed
              sessions, customer charges and astrologer
              earnings.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="asp-admin-back-btn"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadConsultations(true)
              }
              disabled={isRefreshing}
              className="asp-admin-primary-btn"
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
              Unable to load admin data
            </p>

            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-700">
              {successMessage}
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Total Sessions
            </p>

            <p className="mt-3 text-3xl font-semibold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Active
            </p>

            <p className="mt-3 text-3xl font-semibold text-green-700">
              {stats.active}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Completed
            </p>

            <p className="mt-3 text-3xl font-semibold text-blue-700">
              {stats.completed}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Cancelled
            </p>

            <p className="mt-3 text-3xl font-semibold text-red-700">
              {stats.cancelled}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Financial Overview
            </p>

            <p className="mt-3 text-2xl font-semibold text-[#0B1026]">
              <Link href="/admin/finance">View by currency</Link>
            </p>
          </article>
        </section>

        <section className="asp-admin-panel mt-8 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                { setPage(1); setSearch(event.target.value); }
              }
              placeholder="Search by session, customer, astrologer or channel"
              className="asp-admin-input px-4 py-3"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                { setPage(1); setStatusFilter(event.target.value as StatusFilter); }
              }
              className="asp-admin-input px-4 py-3 font-semibold"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="COMPLETED">
                Completed
              </option>

              <option value="CANCELLED">
                Cancelled
              </option>

              <option value="EXPIRED">
                Ended or expired
              </option>
            </select>
          </div>

          <div className="my-4 flex items-center gap-4" aria-label="Consultation pages">
            <button className="asp-admin-button" disabled={isLoading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="asp-admin-button" disabled={isLoading || page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-[#4B5C73]">
                Loading consultations...
              </p>
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-semibold text-[#0B1026]">
                No consultations found
              </h2>

              <p className="mt-2 text-[#4B5C73]">
                No consultation records match the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="asp-admin-table-head">
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Session
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Astrologer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Duration
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Amount
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Status
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-right text-xs font-semibold text-[#243650]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredConsultations.map(
                    (consultation) => {
                      const status =
                        consultation.status.toUpperCase();

                      const isActive = [
                        "ACTIVE",
                        "ONGOING",
                      ].includes(status);

                      const totalMinutes =
                        consultation.purchasedMinutes +
                        consultation.extendedMinutes;

                      return (
                        <tr
                          key={consultation.id}
                          className="align-top"
                        >
                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {consultation.id}
                            </p>

                            <p className="mt-1 break-all text-xs text-[#66758A]">
                              Channel:{" "}
                              {consultation.channelName}
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
                              Started:{" "}
                              {formatDateTime(
                                consultation.startedAt,
                              )}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {getParticipantName(
                                consultation.user,
                                "Customer",
                              )}
                            </p>

                            <p className="mt-1 break-all text-xs text-[#66758A]">
                              {consultation.userId}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {getParticipantName(
                                consultation.astrologer,
                                "Astrologer",
                              )}
                            </p>

                            <p className="mt-1 break-all text-xs text-[#66758A]">
                              {consultation.astrologerId}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {totalMinutes} minutes
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
                              Purchased:{" "}
                              {consultation.purchasedMinutes}
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
                              Extended:{" "}
                              {consultation.extendedMinutes}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {formatCurrency(
                                consultation.amountCharged,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
                              {formatCurrency(
                                consultation.ratePerMinute,
                              )}
                              /min
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                                consultation.status,
                              )}`}
                            >
                              {getStatusLabel(
                                consultation.status,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/admin/consultations/${encodeURIComponent(
                                  consultation.id,
                                )}`}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#0B1026] transition hover:bg-gray-50"
                              >
                                View Details
                              </Link>

                              {isActive ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void updateConsultationStatus(
                                        consultation.id,
                                        "complete",
                                      )
                                    }
                                    title="Admin completion and cancellation are currently unavailable"
                                    disabled={
                                      !ADMIN_CONSULTATION_MUTATIONS_AVAILABLE || updatingId ===
                                      consultation.id
                                    }
                                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {updatingId ===
                                    consultation.id
                                      ? "Updating..."
                                      : "Complete"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void updateConsultationStatus(
                                        consultation.id,
                                        "cancel",
                                      )
                                    }
                                    title="Admin completion and cancellation are currently unavailable"
                                    disabled={
                                      !ADMIN_CONSULTATION_MUTATIONS_AVAILABLE || updatingId ===
                                      consultation.id
                                    }
                                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {updatingId ===
                                    consultation.id
                                      ? "Updating..."
                                      : "Cancel"}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

