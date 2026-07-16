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

type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "PAID"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | string;

type PaymentUserProfile = {
  fullName?: string | null;
  avatarUrl?: string | null;
};

type PaymentUser = {
  id?: string;
  email?: string | null;
  phone?: string | null;
  userProfile?: PaymentUserProfile | null;
  profile?: PaymentUserProfile | null;
};

type AdminPayment = {
  id: string;
  userId?: string | null;
  amount: number | string;
  currency?: string | null;
  status: PaymentStatus;
  paymentType?: string | null;
  provider?: string | null;

  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;

  refundAmount?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  user?: PaymentUser | null;
};

type AdminPaymentsResponse = {
  success?: boolean;
  message?: string | string[];
  data?:
    | AdminPayment[]
    | {
        payments?: AdminPayment[];
        orders?: AdminPayment[];
        items?: AdminPayment[];
        total?: number;
      };
};

type StatusFilter =
  | "ALL"
  | "SUCCESS"
  | "PENDING"
  | "FAILED"
  | "REFUNDED";

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

function getUserName(payment: AdminPayment) {
  const profile =
    payment.user?.userProfile ??
    payment.user?.profile;

  return (
    profile?.fullName?.trim() ||
    payment.user?.email?.trim() ||
    payment.user?.phone?.trim() ||
    "Astro Soul Path Customer"
  );
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function isSuccessfulStatus(status: string) {
  return [
    "SUCCESS",
    "PAID",
    "COMPLETED",
  ].includes(normalizeStatus(status));
}

function getStatusLabel(status: string) {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "SUCCESS":
    case "PAID":
    case "COMPLETED":
      return "Successful";

    case "PENDING":
      return "Pending";

    case "FAILED":
      return "Failed";

    case "CANCELLED":
      return "Cancelled";

    case "REFUNDED":
      return "Refunded";

    default:
      return normalized || "Unknown";
  }
}

function getStatusClasses(status: string) {
  const normalized = normalizeStatus(status);

  if (
    ["SUCCESS", "PAID", "COMPLETED"].includes(
      normalized,
    )
  ) {
    return "border-green-200 bg-green-100 text-green-700";
  }

  if (normalized === "PENDING") {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }

  if (
    ["FAILED", "CANCELLED"].includes(normalized)
  ) {
    return "border-red-200 bg-red-100 text-red-700";
  }

  if (normalized === "REFUNDED") {
    return "border-blue-200 bg-blue-100 text-blue-700";
  }

  return "border-gray-200 bg-gray-100 text-gray-700";
}

function normalizePayments(
  response: AdminPaymentsResponse | null,
): AdminPayment[] {
  if (!response?.data) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  const items =
    response.data.payments ??
    response.data.orders ??
    response.data.items;

  return Array.isArray(items) ? items : [];
}

function getErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Unable to load payments.";
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<
    AdminPayment[]
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadPayments = useCallback(
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
          )}/admin/payments`,
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
          )) as AdminPaymentsResponse | null;

        if (!response.ok) {
          const rawMessage = data?.message;

          const message = Array.isArray(rawMessage)
            ? rawMessage.join(", ")
            : rawMessage;

          throw new Error(
            message ||
              `Unable to load payments (${response.status}).`,
          );
        }

        setPayments(normalizePayments(data));
      } catch (error) {
        setPayments([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return payments.filter((payment) => {
      const status = normalizeStatus(
        payment.status,
      );

      const orderId =
        payment.razorpayOrderId ??
        payment.orderId ??
        "";

      const paymentId =
        payment.razorpayPaymentId ??
        payment.paymentId ??
        "";

      const matchesSearch =
        !keyword ||
        payment.id
          .toLowerCase()
          .includes(keyword) ||
        payment.userId
          ?.toLowerCase()
          .includes(keyword) ||
        getUserName(payment)
          .toLowerCase()
          .includes(keyword) ||
        orderId.toLowerCase().includes(keyword) ||
        paymentId.toLowerCase().includes(keyword) ||
        payment.user?.email
          ?.toLowerCase()
          .includes(keyword) ||
        payment.user?.phone
          ?.toLowerCase()
          .includes(keyword);

      if (!matchesSearch) {
        return false;
      }

      switch (statusFilter) {
        case "SUCCESS":
          return isSuccessfulStatus(status);

        case "PENDING":
          return status === "PENDING";

        case "FAILED":
          return [
            "FAILED",
            "CANCELLED",
          ].includes(status);

        case "REFUNDED":
          return status === "REFUNDED";

        case "ALL":
        default:
          return true;
      }
    });
  }, [payments, search, statusFilter]);

  const stats = useMemo(() => {
    const successfulPayments = payments.filter(
      (payment) =>
        isSuccessfulStatus(payment.status),
    );

    const pendingPayments = payments.filter(
      (payment) =>
        normalizeStatus(payment.status) ===
        "PENDING",
    );

    const failedPayments = payments.filter(
      (payment) =>
        ["FAILED", "CANCELLED"].includes(
          normalizeStatus(payment.status),
        ),
    );

    const refundedPayments = payments.filter(
      (payment) =>
        normalizeStatus(payment.status) ===
        "REFUNDED",
    );

    const successfulAmount =
      successfulPayments.reduce(
        (sum, payment) =>
          sum + getSafeNumber(payment.amount),
        0,
      );

    const refundedAmount =
      refundedPayments.reduce(
        (sum, payment) =>
          sum +
          getSafeNumber(
            payment.refundAmount ??
              payment.amount,
          ),
        0,
      );

    return {
      total: payments.length,
      successful: successfulPayments.length,
      pending: pendingPayments.length,
      failed: failedPayments.length,
      refunded: refundedPayments.length,
      successfulAmount,
      refundedAmount,
    };
  }, [payments]);

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Admin Panel
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Payment Management
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Track successful, pending, failed and
              refunded payments across the platform.
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
                void loadPayments(true)
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
              Unable to load payment data
            </p>

            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Payments
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Successful Amount
            </p>

            <p className="mt-3 text-2xl font-extrabold text-green-700">
              {formatCurrency(
                stats.successfulAmount,
              )}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {stats.successful} successful payments
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Pending Payments
            </p>

            <p className="mt-3 text-3xl font-extrabold text-amber-700">
              {stats.pending}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Refunded Amount
            </p>

            <p className="mt-3 text-2xl font-extrabold text-blue-700">
              {formatCurrency(
                stats.refundedAmount,
              )}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {stats.refunded} refunded payments
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Failed or Cancelled
            </p>

            <p className="mt-3 text-3xl font-extrabold text-red-700">
              {stats.failed}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Successful Payments
            </p>

            <p className="mt-3 text-3xl font-extrabold text-green-700">
              {stats.successful}
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
              placeholder="Search by customer, payment ID, order ID or user ID"
              className="rounded-xl border border-gray-300 px-4 py-3 text-[#0B1026] outline-none transition focus:border-[#D4AF37]"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter,
                )
              }
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-[#0B1026] outline-none focus:border-[#D4AF37]"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="SUCCESS">
                Successful
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="FAILED">
                Failed or cancelled
              </option>

              <option value="REFUNDED">
                Refunded
              </option>
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-gray-600">
                Loading payments...
              </p>
            </div>
          ) : !errorMessage &&
            filteredPayments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl font-extrabold text-[#0B1026]">
                ₹
              </div>

              <h2 className="mt-5 text-2xl font-extrabold text-[#0B1026]">
                No payments found
              </h2>

              <p className="mt-2 text-gray-600">
                No payment records match the selected
                filters.
              </p>
            </div>
          ) : !errorMessage ? (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Payment
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Amount
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Type
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Status
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map(
                    (payment) => {
                      const orderId =
                        payment.razorpayOrderId ??
                        payment.orderId ??
                        "Not available";

                      const providerPaymentId =
                        payment.razorpayPaymentId ??
                        payment.paymentId ??
                        "Not available";

                      return (
                        <tr
                          key={payment.id}
                          className="align-top transition hover:bg-gray-50"
                        >
                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {getUserName(payment)}
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              {payment.user?.phone ||
                                payment.user?.email ||
                                "Contact unavailable"}
                            </p>

                            <p className="mt-1 break-all text-xs text-gray-400">
                              User ID:{" "}
                              {payment.userId ||
                                payment.user?.id ||
                                "Not available"}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="break-all text-sm font-bold text-[#0B1026]">
                              ID: {payment.id}
                            </p>

                            <p className="mt-1 break-all text-xs text-gray-500">
                              Order: {orderId}
                            </p>

                            <p className="mt-1 break-all text-xs text-gray-500">
                              Payment:{" "}
                              {providerPaymentId}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="text-lg font-extrabold text-[#0B1026]">
                              {formatCurrency(
                                payment.amount,
                                payment.currency ||
                                  "INR",
                              )}
                            </p>

                            {getSafeNumber(
                              payment.refundAmount,
                            ) > 0 ? (
                              <p className="mt-1 text-xs font-semibold text-blue-700">
                                Refunded:{" "}
                                {formatCurrency(
                                  payment.refundAmount,
                                  payment.currency ||
                                    "INR",
                                )}
                              </p>
                            ) : null}
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-semibold text-[#0B1026]">
                              {payment.paymentType ||
                                "General Payment"}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {payment.provider ||
                                "Payment provider"}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                                payment.status,
                              )}`}
                            >
                              {getStatusLabel(
                                payment.status,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="text-sm font-semibold text-gray-700">
                              {formatDateTime(
                                payment.createdAt,
                              )}
                            </p>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}