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

type AdminAstrologer = {
  id: string;
  userId: string;
  bio?: string | null;
  languages?: string[];
  experience?: number | null;
  pricePerMin?: number | null;
  rating?: number | null;
  totalReviews?: number;
  isApproved: boolean;
  isVerified: boolean;
  isOnline: boolean;
  profileUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;

  user?: {
    id?: string;
    email?: string | null;
    phone?: string | null;
    userProfile?: {
      fullName?: string | null;
      avatarUrl?: string | null;
    } | null;
  } | null;

  expertise?: Array<{
    expertise?: {
      id?: string;
      name?: string;
    } | null;
  }>;
};

type AdminAstrologersResponse = {
  success: boolean;
  data: AdminAstrologer[];
  message?: string;
};

type StatusFilter =
  | "ALL"
  | "PENDING"
  | "APPROVED"
  | "SUSPENDED"
  | "ONLINE";

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

function getAstrologerName(astrologer: AdminAstrologer) {
  return (
    astrologer.user?.userProfile?.fullName?.trim() ||
    astrologer.user?.email?.trim() ||
    astrologer.user?.phone?.trim() ||
    "Astro Soul Path Astrologer"
  );
}

function getExpertise(astrologer: AdminAstrologer) {
  const values =
    astrologer.expertise
      ?.map((item) => item.expertise?.name?.trim())
      .filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item),
      ) ?? [];

  return values.length ? values.join(", ") : "Not specified";
}

function getStatusLabel(astrologer: AdminAstrologer) {
  if (
    astrologer.isApproved &&
    astrologer.isVerified
  ) {
    return "Approved";
  }

  if (
    !astrologer.isApproved &&
    !astrologer.isVerified
  ) {
    return "Pending";
  }

  return "Suspended";
}

function getStatusClasses(astrologer: AdminAstrologer) {
  if (
    astrologer.isApproved &&
    astrologer.isVerified
  ) {
    return "border-green-200 bg-green-100 text-green-700";
  }

  if (
    !astrologer.isApproved &&
    !astrologer.isVerified
  ) {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }

  return "border-red-200 bg-red-100 text-red-700";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load astrologers.";
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export default function AdminAstrologersPage() {
  const [astrologers, setAstrologers] = useState<
    AdminAstrologer[]
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
  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  const loadAstrologers = useCallback(
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
          `${API_BASE_URL.replace(/\/+$/, "")}/admin/astrologers`,
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
          )) as AdminAstrologersResponse | null;

        if (!response.ok) {
          const rawMessage = (data as { message?: unknown })?.message;

          const message = Array.isArray(rawMessage)
             ? rawMessage.join(", ")
             : typeof rawMessage === "string"
             ? rawMessage
             : undefined;
          throw new Error(
            message ||
              `Unable to load astrologers (${response.status}).`,
          );
        }

        setAstrologers(
          Array.isArray(data?.data) ? data.data : [],
        );
      } catch (error) {
        setAstrologers([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadAstrologers();
  }, [loadAstrologers]);

  const filteredAstrologers = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return astrologers.filter((astrologer) => {
      const matchesSearch =
        !normalizedSearch ||
        getAstrologerName(astrologer)
          .toLowerCase()
          .includes(normalizedSearch) ||
        astrologer.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        astrologer.userId
          .toLowerCase()
          .includes(normalizedSearch) ||
        getExpertise(astrologer)
          .toLowerCase()
          .includes(normalizedSearch) ||
        (astrologer.languages ?? [])
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      switch (statusFilter) {
        case "PENDING":
          return (
            !astrologer.isApproved &&
            !astrologer.isVerified
          );

        case "APPROVED":
          return (
            astrologer.isApproved &&
            astrologer.isVerified
          );

        case "SUSPENDED":
          return (
            !astrologer.isApproved &&
            astrologer.isVerified
          );

        case "ONLINE":
          return astrologer.isOnline;

        case "ALL":
        default:
          return true;
      }
    });
  }, [astrologers, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: astrologers.length,

      pending: astrologers.filter(
        (item) =>
          !item.isApproved && !item.isVerified,
      ).length,

      approved: astrologers.filter(
        (item) =>
          item.isApproved && item.isVerified,
      ).length,

      online: astrologers.filter(
        (item) => item.isOnline,
      ).length,
    };
  }, [astrologers]);

  async function updateAstrologer(
    astrologerId: string,
    action: "approve" | "suspend",
  ) {
    try {
      setUpdatingId(astrologerId);
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
        )}/admin/astrologers/${encodeURIComponent(
          astrologerId,
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
            `Unable to ${action} astrologer.`,
        );
      }

      setAstrologers((current) =>
        current.map((item) => {
          if (item.id !== astrologerId) {
            return item;
          }

          return {
            ...item,
            isApproved: action === "approve",
            isVerified: action === "approve",
          };
        }),
      );

      setSuccessMessage(
        action === "approve"
          ? "Astrologer approved successfully."
          : "Astrologer suspended successfully.",
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
              Astrologer Management
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Review astrologer accounts, approval status,
              availability and consultation pricing.
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
                void loadAstrologers(true)
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

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Astrologers
            </p>
            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Pending Approval
            </p>
            <p className="mt-3 text-3xl font-extrabold text-amber-700">
              {stats.pending}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Approved
            </p>
            <p className="mt-3 text-3xl font-extrabold text-green-700">
              {stats.approved}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Online
            </p>
            <p className="mt-3 text-3xl font-extrabold text-blue-700">
              {stats.online}
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
              placeholder="Search by name, language, expertise or ID"
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
              <option value="PENDING">
                Pending
              </option>
              <option value="APPROVED">
                Approved
              </option>
              <option value="SUSPENDED">
                Suspended
              </option>
              <option value="ONLINE">
                Online
              </option>
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-gray-600">
                Loading astrologers...
              </p>
            </div>
          ) : filteredAstrologers.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                No astrologers found
              </h2>

              <p className="mt-2 text-gray-600">
                No astrologer records match the selected filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Astrologer
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Expertise
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Price
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Status
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Availability
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right text-sm font-bold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAstrologers.map(
                    (astrologer) => (
                      <tr
                        key={astrologer.id}
                        className="align-top"
                      >
                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="font-bold text-[#0B1026]">
                            {getAstrologerName(
                              astrologer,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            ID: {astrologer.id}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            {(astrologer.languages ?? [])
                              .join(", ") ||
                              "Languages not specified"}
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5 text-sm text-gray-700">
                          {getExpertise(astrologer)}
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="font-bold text-[#0B1026]">
                            ₹
                            {Number(
                              astrologer.pricePerMin ??
                                0,
                            ).toFixed(2)}
                            /min
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {astrologer.experience ?? 0}{" "}
                            years experience
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                              astrologer,
                            )}`}
                          >
                            {getStatusLabel(
                              astrologer,
                            )}
                          </span>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              astrologer.isOnline
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {astrologer.isOnline
                              ? "Online"
                              : "Offline"}
                          </span>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/astrologers/${encodeURIComponent(
                                astrologer.id,
                              )}`}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#0B1026] transition hover:bg-gray-50"
                            >
                              View Profile
                            </Link>

                            {!astrologer.isApproved ||
                            !astrologer.isVerified ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAstrologer(
                                    astrologer.id,
                                    "approve",
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  astrologer.id
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                              >
                                {updatingId ===
                                astrologer.id
                                  ? "Updating..."
                                  : "Approve"}
                              </button>
                            ) : null}

                            {astrologer.isApproved &&
                            astrologer.isVerified ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAstrologer(
                                    astrologer.id,
                                    "suspend",
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  astrologer.id
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                              >
                                {updatingId ===
                                astrologer.id
                                  ? "Updating..."
                                  : "Suspend"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ),
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