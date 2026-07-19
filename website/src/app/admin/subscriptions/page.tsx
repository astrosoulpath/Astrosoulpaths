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

type SubscriptionStatus =
  | "ACTIVE"
  | "PENDING"
  | "EXPIRED"
  | "CANCELLED"
  | "PAUSED"
  | string;

type SubscriptionUser = {
  id?: string;
  email?: string | null;
  phone?: string | null;
  userProfile?: {
    fullName?: string | null;
  } | null;
};

type SubscriptionPlan = {
  id?: string;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  durationDays?: number | null;
};

type AdminSubscription = {
  id: string;
  userId?: string | null;
  planId?: string | null;
  status: SubscriptionStatus;
  amount?: number | string | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  autoRenew?: boolean | null;
  user?: SubscriptionUser | null;
  plan?: SubscriptionPlan | null;
};

type AdminSubscriptionsResponse = {
  success?: boolean;
  message?: string | string[];
  data?:
    | AdminSubscription[]
    | {
        subscriptions?: AdminSubscription[];
        items?: AdminSubscription[];
      };
};

type StatusFilter =
  | "ALL"
  | "ACTIVE"
  | "PENDING"
  | "EXPIRED"
  | "CANCELLED";

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
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

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function getStatusClasses(status: string) {
  switch (normalizeStatus(status)) {
    case "ACTIVE":
      return "border-green-200 bg-green-100 text-green-700";

    case "PENDING":
      return "border-amber-200 bg-amber-100 text-amber-700";

    case "EXPIRED":
      return "border-gray-200 bg-gray-200 text-gray-700";

    case "CANCELLED":
      return "border-red-200 bg-red-100 text-red-700";

    case "PAUSED":
      return "border-blue-200 bg-blue-100 text-blue-700";

    default:
      return "border-gray-200 bg-gray-100 text-gray-700";
  }
}

function getUserName(subscription: AdminSubscription) {
  return (
    subscription.user?.userProfile?.fullName?.trim() ||
    subscription.user?.email?.trim() ||
    subscription.user?.phone?.trim() ||
    "Astro Soul Path Customer"
  );
}

function normalizeSubscriptions(
  response: AdminSubscriptionsResponse | null,
) {
  if (!response?.data) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return (
    response.data.subscriptions ??
    response.data.items ??
    []
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to load subscriptions.";
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<
    AdminSubscription[]
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadSubscriptions = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
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
          )}/admin/subscriptions`,
          {
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
          )) as AdminSubscriptionsResponse | null;

        if (!response.ok) {
          const rawMessage = data?.message;

          throw new Error(
            Array.isArray(rawMessage)
              ? rawMessage.join(", ")
              : rawMessage ||
                  `Unable to load subscriptions (${response.status}).`,
          );
        }

        setSubscriptions(
          normalizeSubscriptions(data),
        );
      } catch (error) {
        setSubscriptions([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return subscriptions.filter((subscription) => {
      const status = normalizeStatus(
        subscription.status,
      );

      const matchesSearch =
        !keyword ||
        subscription.id
          .toLowerCase()
          .includes(keyword) ||
        subscription.userId
          ?.toLowerCase()
          .includes(keyword) ||
        getUserName(subscription)
          .toLowerCase()
          .includes(keyword) ||
        subscription.plan?.name
          ?.toLowerCase()
          .includes(keyword);

      if (!matchesSearch) {
        return false;
      }

      return (
        statusFilter === "ALL" ||
        status === statusFilter
      );
    });
  }, [subscriptions, search, statusFilter]);

  const stats = useMemo(() => {
    const active = subscriptions.filter(
      (item) =>
        normalizeStatus(item.status) === "ACTIVE",
    ).length;

    const pending = subscriptions.filter(
      (item) =>
        normalizeStatus(item.status) === "PENDING",
    ).length;

    const expired = subscriptions.filter(
      (item) =>
        normalizeStatus(item.status) === "EXPIRED",
    ).length;

    const cancelled = subscriptions.filter(
      (item) =>
        normalizeStatus(item.status) ===
        "CANCELLED",
    ).length;

    const revenue = subscriptions
      .filter(
        (item) =>
          normalizeStatus(item.status) ===
          "ACTIVE",
      )
      .reduce(
        (sum, item) =>
          sum + getSafeNumber(item.amount),
        0,
      );

    return {
      total: subscriptions.length,
      active,
      pending,
      expired,
      cancelled,
      revenue,
    };
  }, [subscriptions]);

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Admin Panel
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Subscription Management
            </h1>

            <p className="mt-3 text-gray-600">
              Review active plans, subscription periods,
              renewals and customer activity.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-[#0B1026]"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadSubscriptions(true)
              }
              disabled={isRefreshing}
              className="rounded-xl bg-[#0B1026] px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-bold">
              Unable to load subscription data
            </p>
            <p className="mt-1 text-sm">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Total", stats.total],
            ["Active", stats.active],
            ["Pending", stats.pending],
            ["Expired", stats.expired],
            ["Cancelled", stats.cancelled],
            [
              "Active Revenue",
              formatCurrency(stats.revenue),
            ],
          ].map(([label, value]) => (
            <article
              key={String(label)}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-semibold text-gray-500">
                {label}
              </p>
              <p className="mt-3 text-2xl font-extrabold text-[#0B1026]">
                {value}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by customer, plan or subscription ID"
              className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter,
                )
              }
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="ACTIVE">
                Active
              </option>
              <option value="PENDING">
                Pending
              </option>
              <option value="EXPIRED">
                Expired
              </option>
              <option value="CANCELLED">
                Cancelled
              </option>
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center font-semibold text-gray-600">
              Loading subscriptions...
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                No subscriptions found
              </h2>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-3">
                      Customer
                    </th>
                    <th className="px-4 py-3">
                      Plan
                    </th>
                    <th className="px-4 py-3">
                      Amount
                    </th>
                    <th className="px-4 py-3">
                      Period
                    </th>
                    <th className="px-4 py-3">
                      Status
                    </th>
                    <th className="px-4 py-3">
                      Auto Renew
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSubscriptions.map(
                    (subscription) => (
                      <tr
                        key={subscription.id}
                        className="border-b"
                      >
                        <td className="px-4 py-5">
                          <p className="font-bold text-[#0B1026]">
                            {getUserName(subscription)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {subscription.userId}
                          </p>
                        </td>

                        <td className="px-4 py-5">
                          <p className="font-bold">
                            {subscription.plan?.name ||
                              "Subscription Plan"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {subscription.plan
                              ?.durationDays ?? 0}{" "}
                            days
                          </p>
                        </td>

                        <td className="px-4 py-5 font-bold">
                          {formatCurrency(
                            subscription.amount ??
                              subscription.plan?.price,
                            subscription.currency ||
                              "INR",
                          )}
                        </td>

                        <td className="px-4 py-5 text-sm">
                          <p>
                            {formatDate(
                              subscription.startDate,
                            )}
                          </p>
                          <p className="mt-1 text-gray-500">
                            to{" "}
                            {formatDate(
                              subscription.endDate,
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-5">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                              subscription.status,
                            )}`}
                          >
                            {normalizeStatus(
                              subscription.status,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-5 font-semibold">
                          {subscription.autoRenew
                            ? "Enabled"
                            : "Disabled"}
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