"use client";

import { refreshAdminSession } from "@/features/admin/auth/admin-session";
import { paymentTotals } from "@/features/admin/payment-totals";
import { PaymentOperations } from "@/features/admin/payment-operations";

import { getAdminApiBase } from "@/features/admin/auth/admin-contract";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API_BASE_URL = getAdminApiBase();

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
  pagination?: {totalPages?:number};
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

async function getAccessToken() {
  return refreshAdminSession();
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
  currency: string,
) {
  if (!/^[A-Z]{3}$/.test(currency) || !/^\d+(?:\.\d{1,2})?$/.test(String(value ?? '')) || !Number.isFinite(Number(value))) return 'Amount unavailable';
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

  return "border-gray-200 bg-gray-100 text-[#263A55]";
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

  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const sequence=useRef(0);
  const [workflowMessage,setWorkflowMessage]=useState('Loading reconciliation status…');
  const loadPayments = useCallback(
    async (showRefreshState = false) => {
      const version=++sequence.current;
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const token = await getAccessToken();

        if (!token) {
          throw new Error(
            "Admin login token is missing. Please log in as an admin.",
          );
        }

        const response = await fetch(
          `${API_BASE_URL.replace(
            /\/+$/,
            "",
          )}/admin/payments?${new URLSearchParams({page:String(page),limit:"20",search,status:statusFilter})}`,
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

        if(version!==sequence.current)return;
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
        setTotalPages(Math.max(1,data?.pagination?.totalPages??1));
        try {
          const monitor = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/admin/payments/workflow-monitor`, {
            headers:{Accept:'application/json',Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(10000),
          });
          const payload=await readJson(monitor);
          if(version!==sequence.current)return;
          const summary=payload?.data;
          if(!monitor.ok || !summary) throw new Error();
          if(!summary.schemaReady) setWorkflowMessage('Financial workflow schema is not activated. No refund execution is available.');
          else {
            const refunds=Array.isArray(summary.refunds)?summary.refunds:[];
            const exceptions=Array.isArray(summary.exceptions)?summary.exceptions:[];
            setWorkflowMessage([
              ...refunds.map((row:{state:string;currency:string;count:number})=>`Refund ${row.state}: ${row.count} (${row.currency})`),
              ...exceptions.map((row:{status:string;currency:string;count:number})=>`Reconciliation ${row.status}: ${row.count} (${row.currency})`),
            ].join(' · ') || 'No workflow records in the verified schema.');
          }
        } catch {
          if(version===sequence.current)setWorkflowMessage('Reconciliation monitoring unavailable. Payment history remains independently available.');
        }
      } catch (error) {
        if(version!==sequence.current)return;
        setPayments([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if(version===sequence.current){setIsLoading(false);setIsRefreshing(false);}
      }
    },
    [page,search,statusFilter],
  );

  useEffect(() => {
    const lifetime = sequence;
    const timer=setTimeout(()=>{void loadPayments();},250);
    return ()=>{clearTimeout(timer);lifetime.current++;};
  }, [loadPayments]);

  const filteredPayments = payments;

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

    const successfulAmount = paymentTotals(successfulPayments);
    const refundedAmount = paymentTotals(refundedPayments.map(payment => ({amount: payment.refundAmount, currency: payment.currency})));

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
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="asp-admin-title mt-2 text-3xl sm:text-4xl">
              Payment Management
            </h1>

            <p className="asp-admin-subtitle mt-3 max-w-3xl text-base">
              Track successful, pending, failed and
              refunded payments across the platform.
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
                void loadPayments(true)
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
              Unable to load payment data
            </p>

            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <section className="asp-admin-stat-card mt-6" aria-label="Reconciliation and refund monitoring">
          <h2 className="font-semibold">Reconciliation and refund monitoring</h2>
          <p className="mt-2 text-sm" role="status">{workflowMessage}</p>
          <p className="mt-1 text-xs">Read-only provider workflow status; confirmation does not imply journal settlement.</p>
        </section>
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Payments on this page
            </p>

            <p className="mt-3 text-3xl font-semibold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Successful Amount · this page
            </p>

            <p className="mt-3 text-2xl font-semibold text-green-700">
              {stats.successfulAmount.totals.map(total => formatCurrency(total.amount, total.currency)).join(' · ') || 'No recorded amounts'}
              {stats.successfulAmount.unavailable > 0 && <span className="block text-xs">Some amounts unavailable</span>}
            </p>

            <p className="mt-1 text-xs text-[#66758A]">
              {stats.successful} successful payments
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Pending Payments
            </p>

            <p className="mt-3 text-3xl font-semibold text-amber-700">
              {stats.pending}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Refunded Amount · this page
            </p>

            <p className="mt-3 text-2xl font-semibold text-blue-700">
              {stats.refundedAmount.totals.map(total => formatCurrency(total.amount, total.currency)).join(' · ') || 'No recorded refund amounts'}
              {stats.refundedAmount.unavailable > 0 && <span className="block text-xs">Some refund amounts unavailable</span>}
            </p>

            <p className="mt-1 text-xs text-[#66758A]">
              {stats.refunded} refunded payments
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Failed or Cancelled
            </p>

            <p className="mt-3 text-3xl font-semibold text-red-700">
              {stats.failed}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Successful Payments
            </p>

            <p className="mt-3 text-3xl font-semibold text-green-700">
              {stats.successful}
            </p>
          </article>
        </section>

        <section className="asp-admin-panel mt-8 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                {setPage(1);setSearch(event.target.value);}
              }
              placeholder="Search by customer, payment ID, order ID or user ID"
              className="asp-admin-input px-4 py-3"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter,
                )
              }
              className="asp-admin-input px-4 py-3 font-semibold"
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

          <p className="my-3 text-sm">Summaries cover the loaded page and selected filters.</p><div className="my-4 flex gap-4 items-center" aria-label="Record pages"><button disabled={isLoading || page<=1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={isLoading || page>=totalPages} onClick={()=>setPage(page+1)}>Next</button></div>
          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-[#4B5C73]">
                Loading payments...
              </p>
            </div>
          ) : !errorMessage &&
            filteredPayments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl font-semibold text-[#0B1026]">
                Ã¢â€šÂ¹
              </div>

              <h2 className="mt-5 text-2xl font-semibold text-[#0B1026]">
                No payments found
              </h2>

              <p className="mt-2 text-[#4B5C73]">
                No payment records match the selected
                filters.
              </p>
            </div>
          ) : !errorMessage ? (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="asp-admin-table-head">
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Payment
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Amount
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Type
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Status
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
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

                            <p className="mt-1 text-sm text-[#4B5C73]">
                              {payment.user?.phone ||
                                payment.user?.email ||
                                "Contact unavailable"}
                            </p>

                            <p className="mt-1 break-all text-xs text-[#758297]">
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
                            <PaymentOperations id={payment.id} />

                            <p className="mt-1 break-all text-xs text-[#66758A]">
                              Order: {orderId}
                            </p>

                            <p className="mt-1 break-all text-xs text-[#66758A]">
                              Payment:{" "}
                              {providerPaymentId}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="text-lg font-semibold text-[#0B1026]">
                              {formatCurrency(
                                payment.amount,
                                payment.currency || "",
                              )}
                            </p>

                            {getSafeNumber(
                              payment.refundAmount,
                            ) > 0 ? (
                              <p className="mt-1 text-xs font-semibold text-blue-700">
                                Refunded:{" "}
                                {formatCurrency(
                                  payment.refundAmount,
                                  payment.currency || "",
                                )}
                              </p>
                            ) : null}
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-semibold text-[#0B1026]">
                              {payment.paymentType ||
                                "General Payment"}
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
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
                            <p className="text-sm font-semibold text-[#263A55]">
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

