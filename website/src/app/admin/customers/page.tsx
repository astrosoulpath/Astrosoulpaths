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

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

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

  const loadCustomers = useCallback(
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
          )}/admin/customers`,
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
          )) as AdminCustomersResponse | null;

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
      } catch (error) {
        setCustomers([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return customers.filter((customer) => {
      const customerName =
        getCustomerName(customer).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        customerName.includes(normalizedSearch) ||
        customer.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        customer.email
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        customer.phone
          ?.toLowerCase()
          .includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      const isBlocked =
        customer.isBlocked === true ||
        customer.isActive === false;

      const hasWallet = Boolean(customer.wallet);

      switch (statusFilter) {
        case "ACTIVE":
          return !isBlocked;

        case "BLOCKED":
          return isBlocked;

        case "WITH_WALLET":
          return hasWallet;

        case "WITHOUT_WALLET":
          return !hasWallet;

        case "ALL":
        default:
          return true;
      }
    });
  }, [customers, search, statusFilter]);

  const stats = useMemo(() => {
    const totalWalletBalance = customers.reduce(
      (sum, customer) =>
        sum +
        getSafeNumber(
          customer.wallet?.balance,
        ),
      0,
    );

    const blocked = customers.filter(
      (customer) =>
        customer.isBlocked === true ||
        customer.isActive === false,
    ).length;

    return {
      total: customers.length,
      active: customers.length - blocked,
      blocked,
      walletBalance: totalWalletBalance,
    };
  }, [customers]);

  async function updateCustomerStatus(
    customerId: string,
    action: "block" | "unblock",
  ) {
    try {
      setUpdatingId(customerId);
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
        )}/admin/customers/${encodeURIComponent(
          customerId,
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
            `Unable to ${action} customer.`,
        );
      }

      setCustomers((currentCustomers) =>
        currentCustomers.map((customer) => {
          if (customer.id !== customerId) {
            return customer;
          }

          const blocked = action === "block";

          return {
            ...customer,
            isBlocked: blocked,
            isActive: !blocked,
          };
        }),
      );

      setSuccessMessage(
        action === "block"
          ? "Customer blocked successfully."
          : "Customer unblocked successfully.",
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
              Customer Management
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Review customer accounts, wallet balances,
              account status and consultation activity.
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
                void loadCustomers(true)
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
              Total Customers
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Active Customers
            </p>

            <p className="mt-3 text-3xl font-extrabold text-green-700">
              {stats.active}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Blocked Customers
            </p>

            <p className="mt-3 text-3xl font-extrabold text-red-700">
              {stats.blocked}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Wallet Balance
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {formatCurrency(
                stats.walletBalance,
              )}
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
              placeholder="Search by name, email, phone or customer ID"
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
              <p className="font-semibold text-gray-600">
                Loading customers...
              </p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                No customers found
              </h2>

              <p className="mt-2 text-gray-600">
                No customer records match the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Contact
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Wallet
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Activity
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
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-lg font-extrabold text-[#0B1026]">
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

                                <p className="mt-1 break-all text-xs text-gray-500">
                                  ID: {customer.id}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
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

                            <p className="mt-1 text-sm text-gray-600">
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

                            <p className="mt-1 text-xs text-gray-500">
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

                            <p className="mt-1 text-xs text-gray-500">
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
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#0B1026] transition hover:bg-gray-50"
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
                                disabled={
                                  updatingId ===
                                  customer.id
                                }
                                className={`rounded-lg px-3 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
      </div>
    </main>
  );
}