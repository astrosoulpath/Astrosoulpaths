"use client";
import { ModerationDialog, type ModerationAction } from '@/features/admin/moderation/ModerationDialog';
﻿

import { adminFetch } from "@/features/admin/auth/admin-session";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";



type CustomerWallet = {
  id?: string;
  balance?: number | string | null;
  lockedBalance?: number | string | null;
  currency?: string | null;
};

type CustomerProfile = {
  fullName?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
};

type AdminCustomer = {
  id: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean | null;
  isBlocked?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  userProfile?: CustomerProfile | null;
  profile?: CustomerProfile | null;
  wallet?: CustomerWallet | null;

  _count?: {
    calls?: number;
    messages?: number;
    reviews?: number;
  };
};

type AdminCustomersResponse = {
  success: boolean;
  pagination?: {page: number; limit: number; total: number; totalPages: number};
  message?: string;
  data:
    | AdminCustomer[]
    | {
        customers?: AdminCustomer[];
        users?: AdminCustomer[];
        items?: AdminCustomer[];
        total?: number;
      };
};

type StatusFilter =
  | "ALL"
  | "ACTIVE"
  | "BLOCKED"
  | "WITH_WALLET"
  | "WITHOUT_WALLET";

function getSafeNumber(
  value: number | string | null | undefined,
) {
  const parsedValue = Number(value ?? 0);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function formatCurrency(
  value: number | string | null | undefined,
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
    timeStyle: "short",
  }).format(date);
}

function getCustomerProfile(customer: AdminCustomer) {
  return customer.userProfile ?? customer.profile ?? null;
}

function getCustomerName(customer: AdminCustomer) {
  const profile = getCustomerProfile(customer);

  return (
    profile?.fullName?.trim() ||
    customer.email?.trim() ||
    customer.phone?.trim() ||
    "Astro Soul Path Customer"
  );
}

function getCustomerStatus(customer: AdminCustomer) {
  if (
    customer.isBlocked === true ||
    customer.isActive === false
  ) {
    return "Blocked";
  }

  return "Active";
}

function getStatusClasses(customer: AdminCustomer) {
  if (
    customer.isBlocked === true ||
    customer.isActive === false
  ) {
    return "border-red-200 bg-red-100 text-red-700";
  }

  return "border-green-200 bg-green-100 text-green-700";
}

function getErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Unable to load customers.";
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function normalizeCustomers(
  response: AdminCustomersResponse | null,
): AdminCustomer[] {
  if (!response) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  const possibleData =
    response.data.customers ??
    response.data.users ??
    response.data.items;

  return Array.isArray(possibleData)
    ? possibleData
    : [];
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<
    AdminCustomer[]
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

  const requestSequence = useRef(0);
  const [moderation,setModeration]=useState<{id:string;action:ModerationAction}|null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const loadCustomers = useCallback(
    async (showRefreshState = false) => {
      const sequence = ++requestSequence.current;
      const owner = localStorage.getItem('asp_admin_firebase_uid');
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const query = new URLSearchParams({page: String(page), limit: '20', search, status: statusFilter});
        const response = await adminFetch('/admin/customers?' + query, {method: 'GET'});

        const data =
          (await readJson(
            response,
          )) as AdminCustomersResponse | null;

        if (sequence !== requestSequence.current) return;
        if (!owner || owner !== localStorage.getItem('asp_admin_firebase_uid') || !localStorage.getItem('asp_admin_access_token')) throw new Error('Admin session changed.');
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
              `Unable to load customers (${response.status}).`,
          );
        }

        setCustomers(normalizeCustomers(data));
        setTotalPages(data?.pagination?.totalPages ?? 0);
      } catch (error) {
        if (sequence !== requestSequence.current) return;
        setCustomers([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (sequence !== requestSequence.current) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, search, statusFilter],
  );

  useEffect(() => {
    void loadCustomers();
    const sequence = requestSequence;
    return () => { sequence.current++; };
  }, [loadCustomers]);

  const filteredCustomers = customers;

  const stats = useMemo(() => {
    const wallets = new Map<string, number>();
    for (const customer of customers) {
      if (!customer.wallet) continue;
      const currency = customer.wallet.currency || 'UNSPECIFIED';
      wallets.set(currency, (wallets.get(currency) ?? 0) + getSafeNumber(customer.wallet.balance));
    }
    const blocked = customers.filter(
      (customer) =>
        customer.isBlocked === true ||
        customer.isActive === false,
    ).length;

    return {
      total: customers.length,
      active: customers.length - blocked,
      blocked,
      wallets: [...wallets.entries()],
    };
  }, [customers]);

  async function updateCustomerStatus(customerId:string,action:'block'|'unblock') { setModeration({id:customerId,action:action.toUpperCase() as ModerationAction}); }

  return (
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      {moderation && <ModerationDialog kind="customers" {...moderation} onClose={()=>setModeration(null)} onDone={()=>{setModeration(null);setUpdatingId(null);setSuccessMessage('Audited moderation confirmed.');void loadCustomers(true);}} />}
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="asp-admin-title mt-2 text-3xl sm:text-4xl">
              Customer Management
            </h1>

            <p className="asp-admin-subtitle mt-3 max-w-3xl text-base">
              Review customer accounts, wallet balances,
              account status and consultation activity.
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
                void loadCustomers(true)
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

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Total Customers
            </p>

            <p className="asp-admin-stat-value">
              {stats.total}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Active Customers
            </p>

            <p className="asp-admin-stat-value text-green-700">
              {stats.active}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Blocked Customers
            </p>

            <p className="asp-admin-stat-value text-red-700">
              {stats.blocked}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Wallet balances (this page)
            </p>

            <p className="asp-admin-stat-value">
              {stats.wallets.length ? stats.wallets.map(([currency, amount]) => currency === 'UNSPECIFIED' ? 'Currency unavailable' : formatCurrency(amount, currency)).join(' / ') : 'No wallets'}
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
              placeholder="Search by name, email, phone or customer ID"
              className="asp-admin-input px-4 py-3"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                {setPage(1); setStatusFilter(event.target.value as StatusFilter);}
              }
              className="asp-admin-input px-4 py-3 font-semibold"
            >
              <option value="ALL">
                All customers
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="BLOCKED">
                Blocked
              </option>

              <option value="WITH_WALLET">
                With wallet
              </option>

              <option value="WITHOUT_WALLET">
                Without wallet
              </option>
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-[#4B5C73]">
                Loading customers...
              </p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-semibold text-[#0B1026]">
                No customers found
              </h2>

              <p className="mt-2 text-[#4B5C73]">
                No customer records match the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="asp-admin-table-head">
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Contact
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Wallet
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Activity
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
                  {filteredCustomers.map(
                    (customer) => {
                      const profile =
                        getCustomerProfile(customer);

                      const isBlocked =
                        customer.isBlocked === true ||
                        customer.isActive === false;

                      return (
                        <tr
                          key={customer.id}
                          className="align-top"
                        >
                          <td className="border-b border-gray-100 px-4 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-lg font-semibold text-[#0B1026]">
                                {profile?.avatarUrl ? (
                                   
                                  <img
                                    src={
                                      profile.avatarUrl
                                    }
                                    alt={getCustomerName(
                                      customer,
                                    )}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getCustomerName(
                                    customer,
                                  )
                                    .charAt(0)
                                    .toUpperCase()
                                )}
                              </div>

                              <div>
                                <p className="font-bold text-[#0B1026]">
                                  {getCustomerName(
                                    customer,
                                  )}
                                </p>

                                <p className="mt-1 break-all text-xs text-[#66758A]">
                                  ID: {customer.id}
                                </p>

                                <p className="mt-1 text-xs text-[#66758A]">
                                  Joined:{" "}
                                  {formatDate(
                                    customer.createdAt,
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="text-sm font-semibold text-[#0B1026]">
                              {customer.phone ||
                                "Phone not available"}
                            </p>

                            <p className="mt-1 text-sm text-[#4B5C73]">
                              {customer.email ||
                                "Email not available"}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="font-bold text-[#0B1026]">
                              {formatCurrency(
                                customer.wallet
                                  ?.balance,
                                customer.wallet
                                  ?.currency ||
                                  "INR",
                              )}
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
                              Locked:{" "}
                              {formatCurrency(
                                customer.wallet
                                  ?.lockedBalance,
                                customer.wallet
                                  ?.currency ||
                                  "INR",
                              )}
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <p className="text-sm font-semibold text-[#0B1026]">
                              {
                                customer._count
                                  ?.calls
                              ?? 0
                              }{" "}
                              consultations
                            </p>

                            <p className="mt-1 text-xs text-[#66758A]">
                              {
                                customer._count
                                  ?.reviews
                              ?? 0
                              }{" "}
                              reviews
                            </p>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                                customer,
                              )}`}
                            >
                              {getCustomerStatus(
                                customer,
                              )}
                            </span>
                          </td>

                          <td className="border-b border-gray-100 px-4 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/admin/customers/${encodeURIComponent(
                                  customer.id,
                                )}`}
                                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#10233F] shadow-sm transition hover:border-[#D4AF37] hover:bg-[#FFFCF5]"
                              >
                                View Details
                              </Link>

                              <button
                                type="button"
                                onClick={() =>
                                  void updateCustomerStatus(
                                    customer.id,
                                    isBlocked
                                      ? "unblock"
                                      : "block",
                                  )
                                }
                                disabled={isLoading || updatingId === customer.id} title="Review audited status change"
                                className={`rounded-lg px-3 py-2 text-xs font-bold text-[#14243D] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isBlocked
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-600 hover:bg-red-700"
                                }`}
                              >
                                {updatingId ===
                                customer.id
                                  ? "Updating..."
                                  : isBlocked
                                    ? "Unblock"
                                    : "Block"}
                              </button>
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
        <nav aria-label="Customer pagination" className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" disabled={isLoading || page <= 1} onClick={() => setPage(p => p - 1)} className="asp-admin-back-btn">Previous</button>
          <span>Page {page} of {Math.max(1, totalPages)} · Counts above describe this page</span>
          <button type="button" disabled={isLoading || page >= totalPages} onClick={() => setPage(p => p + 1)} className="asp-admin-back-btn">Next</button>
        </nav>
      </div>
    </main>
  );
}

