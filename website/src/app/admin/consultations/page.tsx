"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

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

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

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
      return "border-gray-200 bg-gray-200 text-gray-700";

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

  const loadConsultations = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const token = getAccessToken();

        if (!token) {
          throw new Error(
            "Admin login token is missing. Please log in as an admin.",
          );
        }

        const response = await fetch(
          `${API_BASE_URL.replace(
            /\/+$/,
            "",
          )}/admin/consultations`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const data =
          (await readJson(
            response,
          )) as AdminConsultationsResponse | null;

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

        setConsultations(
          normalizeConsultations(data),
        );
      } catch (error) {
        setConsultations([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadConsultations();
  }, [loadConsultations]);

  const filteredConsultations = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return consultations.filter((consultation) => {
      const userName = getParticipantName(
        consultation.user,
        "Customer",
      ).toLowerCase();

      const astrologerName = getParticipantName(
        consultation.astrologer,
        "Astrologer",
      ).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        consultation.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        consultation.channelName
          .toLowerCase()
          .includes(normalizedSearch) ||
        consultation.userId
          .toLowerCase()
          .includes(normalizedSearch) ||
        consultation.astrologerId
          .toLowerCase()
          .includes(normalizedSearch) ||
        userName.includes(normalizedSearch) ||
        astrologerName.includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      const normalizedStatus =
        consultation.status.toUpperCase();

      switch (statusFilter) {
        case "ACTIVE":
          return ["ACTIVE", "ONGOING"].includes(
            normalizedStatus,
          );

        case "COMPLETED":
          return normalizedStatus === "COMPLETED";

        case "CANCELLED":
          return normalizedStatus === "CANCELLED";

        case "EXPIRED":
          return ["EXPIRED", "ENDED"].includes(
            normalizedStatus,
          );

        case "ALL":
        default:
          return true;
      }
    });
  }, [consultations, search, statusFilter]);

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

    const totalRevenue = consultations
      .filter(
        (item) =>
          item.status.toUpperCase() === "COMPLETED",
      )
      .reduce(
        (sum, item) =>
          sum + getSafeNumber(item.amountCharged),
        0,
      );

    return {
      total: consultations.length,
      active,
      completed,
      cancelled,
      totalRevenue,
    };
  }, [consultations]);

  async function updateConsultationStatus(
    consultationId: string,
    action: "complete" | "cancel",
  ) {
    try {
      setUpdatingId(consultationId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const token = getAccessToken();

      if (!token) {
        throw new Error(
          "Admin login token is missing. Please log in as an admin.",
        );
      }

      const response = await fetch(
        `${API_BASE_URL.replace(
          /\/+$/,
          "",
        )}/admin/consultations/${encodeURIComponent(
          consultationId,
        )}/${action}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
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
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Admin Panel
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Consultation Management
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Monitor active consultations, completed
              sessions, customer charges and astrologer
              earnings.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-center font-bold text-[#0B1026] transition hover:bg-gray-50"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadConsultations(true)
              }
              disabled={isRefreshing}
              className="rounded-xl bg-[#0B1026] px-5 py-3 font-bold text-white transition hover:bg-[#171D3D] disabled:cursor-not-allowed disabled:opacity-60"
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
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Sessions
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Active
            </p>

            <p className="mt-3 text-3xl font-extrabold text-green-700">
              {stats.active}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Completed
            </p>

            <p className="mt-3 text-3xl font-extrabold text-blue-700">
              {stats.completed}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Cancelled
            </p>

            <p className="mt-3 text-3xl font-extrabold text-red-700">
              {stats.cancelled}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Completed Revenue
            </p>

            <p className="mt-3 text-2xl font-extrabold text-[#0B1026]">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by session, customer, astrologer or channel"
              className="rounded-xl border border-gray-300 px-4 py-3 text-[#0B1026] outline-none transition focus:border-[#D4AF37]"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter,
                )
              }
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-[#0B1026] outline-none focus:border-[#D4AF37]"
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

          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-gray-600">
                Loading consultations...
              </p>
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                No consultations found
              </h2>

              <p className="mt-2 text-gray-600">
                No consultation records match the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Session
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Astrologer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Duration
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Amount
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Status
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-right text-sm font-bold text-gray-600">
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

                            <p className="mt-1 break-all text-xs text-gray-500">
                              Channel:{" "}
                              {consultation.channelName}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
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

                            <p className="mt-1 break-all text-xs text-gray-500">
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

                            <p className="mt-1 break-all text-xs text-gray-500">
                              {consultation.astrologerId}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {totalMinutes} minutes
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Purchased:{" "}
                              {consultation.purchasedMinutes}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
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

                            <p className="mt-1 text-xs text-gray-500">
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
                                    disabled={
                                      updatingId ===
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
                                    disabled={
                                      updatingId ===
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