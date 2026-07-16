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

type WalletUser = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type WalletItem = {
  id: string;
  balance: number;
  lockedBalance: number;
  updatedAt: string;
  user: WalletUser;
};

type WalletResponse = {
  success: boolean;
  message?: string;
  data:
    | WalletItem[]
    | {
        wallets?: WalletItem[];
        items?: WalletItem[];
      };
};

type WalletSummary = {
  totalWallets: number;
  totalBalance: number;
  totalLocked: number;
};

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("asp_access_token") ??
    localStorage.getItem("access_token")
  );
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN");
}

export default function AdminWalletPage() {
  const [wallets, setWallets] = useState<
    WalletItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const loadWallets = useCallback(
    async (
      refresh = false,
    ) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const token =
          getAccessToken();

        if (!token) {
          throw new Error(
            "Invalid token",
          );
        }

        const response =
          await fetch(
            `${API_BASE_URL}/admin/wallets`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept:
                  "application/json",
              },
              cache: "no-store",
            },
          );

        const data =
          (await readJson(
            response,
          )) as WalletResponse;

        if (!response.ok) {
          throw new Error(
            data.message ??
              "Unable to load wallets.",
          );
        }

        const items =
          Array.isArray(
            data.data,
          )
            ? data.data
            : data.data.wallets ??
              data.data.items ??
              [];

        setWallets(items);
      } catch (err: any) {
        setWallets([]);

        setError(
          err.message ??
            "Unable to load wallets.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const summary =
    useMemo<WalletSummary>(
      () => ({
        totalWallets:
          wallets.length,

        totalBalance:
          wallets.reduce(
            (sum, wallet) =>
              sum +
              wallet.balance,
            0,
          ),

        totalLocked:
          wallets.reduce(
            (sum, wallet) =>
              sum +
              wallet.lockedBalance,
            0,
          ),
      }),
      [wallets],
    );

  const filteredWallets =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return wallets.filter(
        (wallet) => {
          if (!keyword) {
            return true;
          }

          return (
            wallet.user.name
              .toLowerCase()
              .includes(
                keyword,
              ) ||
            wallet.user.id
              .toLowerCase()
              .includes(
                keyword,
              ) ||
            wallet.id
              .toLowerCase()
              .includes(
                keyword,
              ) ||
            wallet.user.phone
              ?.toLowerCase()
              .includes(
                keyword,
              ) ||
            wallet.user.email
              ?.toLowerCase()
              .includes(
                keyword,
              )
          );
        },
      );
    }, [wallets, search]);

  return (    <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
              Admin Panel
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Wallet & Transactions
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Monitor customer wallet balances, locked funds and
              wallet account activity.
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
              onClick={() => void loadWallets(true)}
              disabled={refreshing}
              className="rounded-xl bg-[#0B1026] px-5 py-3 font-bold text-white transition hover:bg-[#171D3D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Unable to load wallet data
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Wallets
            </p>

            <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
              {summary.totalWallets}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Balance
            </p>

            <p className="mt-3 text-3xl font-extrabold text-green-700">
              {formatCurrency(summary.totalBalance)}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Locked Balance
            </p>

            <p className="mt-3 text-3xl font-extrabold text-orange-600">
              {formatCurrency(summary.totalLocked)}
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                Customer Wallets
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Search wallet records by customer name, phone, email,
                user ID or wallet ID.
              </p>
            </div>

            <p className="text-sm font-semibold text-gray-500">
              Showing {filteredWallets.length} of {wallets.length}
            </p>
          </div>

          <div className="mt-6">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer wallet..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#0B1026] outline-none transition focus:border-[#D4AF37]"
            />
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-gray-600">
                Loading wallets...
              </p>
            </div>
          ) : !error && filteredWallets.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">
                ₹
              </div>

              <h3 className="mt-5 text-2xl font-extrabold text-[#0B1026]">
                No wallets found
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                No wallet records match the current search.
              </p>
            </div>
          ) : !error ? (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Customer
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Wallet Balance
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Locked Balance
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Available Balance
                    </th>

                    <th className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-600">
                      Last Updated
                    </th>
                  </tr>
                </thead>

                <tbody>
                                      {filteredWallets.map((wallet) => {
                    const availableBalance = Math.max(
                      wallet.balance - wallet.lockedBalance,
                      0,
                    );

                    return (
                      <tr
                        key={wallet.id}
                        className="align-top transition hover:bg-gray-50"
                      >
                        <td className="border-b border-gray-100 px-4 py-5">
                          <div>
                            <p className="font-bold text-[#0B1026]">
                              {wallet.user.name?.trim() || "Customer"}
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              {wallet.user.phone ||
                                wallet.user.email ||
                                "Contact unavailable"}
                            </p>

                            <p className="mt-1 break-all text-xs text-gray-400">
                              User ID: {wallet.user.id}
                            </p>

                            <p className="mt-1 break-all text-xs text-gray-400">
                              Wallet ID: {wallet.id}
                            </p>
                          </div>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="text-lg font-extrabold text-green-700">
                            {formatCurrency(wallet.balance)}
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="text-lg font-extrabold text-orange-600">
                            {formatCurrency(wallet.lockedBalance)}
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="text-lg font-extrabold text-[#0B1026]">
                            {formatCurrency(availableBalance)}
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="text-sm font-semibold text-gray-700">
                            {formatDate(wallet.updatedAt)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}