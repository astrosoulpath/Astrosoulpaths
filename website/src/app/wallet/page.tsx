"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getWallet,
  getWalletHistory,
} from "@/services/walletService";

type WalletTransaction = {
  id: string;
  type: "credit" | "debit";
  title: string;
  amount: number;
  date: string;
};

type WalletApiData = {
  id?: string;
  balance?: number;
  availableBalance?: number;
  lockedBalance?: number;
  currency?: string;
};

type WalletApiResponse = {
  success?: boolean;
  data?: WalletApiData;
};

type WalletHistoryItem = {
  id?: string;
  type?: string;
  ledgerType?: string;
  title?: string;
  description?: string;
  amount?: number;
  date?: string;
  createdAt?: string;
};

type WalletHistoryResponse = {
  success?: boolean;
  data?: {
    transactions?: WalletHistoryItem[];
    total?: number;
  };
};

function formatTransactionDate(
  value?: string,
): string {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeTransaction(
  transaction: WalletHistoryItem,
  index: number,
): WalletTransaction {
  const rawType = String(
    transaction.type ??
      transaction.ledgerType ??
      "",
  ).toLowerCase();

  const creditTypes = [
    "credit",
    "recharge",
    "refund",
    "bonus",
    "gift_received",
  ];

  const type: "credit" | "debit" =
    creditTypes.includes(rawType)
      ? "credit"
      : "debit";

  const amount = Number(transaction.amount ?? 0);

  return {
    id:
      transaction.id ??
      `wallet-transaction-${index}`,
    type,
    title:
      transaction.title?.trim() ||
      transaction.description?.trim() ||
      (type === "credit"
        ? "Wallet Recharge"
        : "Consultation Deduction"),
    amount:
      Number.isFinite(amount)
        ? Math.abs(amount)
        : 0,
    date: formatTransactionDate(
      transaction.date ??
        transaction.createdAt,
    ),
  };
}

export default function WalletPage() {
  const router = useRouter();

  const [balance, setBalance] =
    useState(0);

  const [availableBalance, setAvailableBalance] =
    useState(0);

  const [lockedBalance, setLockedBalance] =
    useState(0);

  const [currency, setCurrency] =
    useState("INR");

  const [transactions, setTransactions] =
    useState<WalletTransaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadWallet = useCallback(
    async (refresh = false) => {
      const token = localStorage.getItem(
        "asp_access_token",
      );

      if (!token) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            "/wallet",
          )}`,
        );

        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const [
          walletResponse,
          historyResponse,
        ] = await Promise.all([
          getWallet() as Promise<WalletApiResponse>,
          getWalletHistory() as Promise<WalletHistoryResponse>,
        ]);

        const wallet =
          walletResponse.data;

        const walletBalance = Number(
          wallet?.balance ?? 0,
        );

        const walletAvailableBalance = Number(
          wallet?.availableBalance ??
            walletBalance,
        );

        const walletLockedBalance = Number(
          wallet?.lockedBalance ?? 0,
        );

        setBalance(
          Number.isFinite(walletBalance)
            ? walletBalance
            : 0,
        );

        setAvailableBalance(
          Number.isFinite(
            walletAvailableBalance,
          )
            ? walletAvailableBalance
            : 0,
        );

        setLockedBalance(
          Number.isFinite(
            walletLockedBalance,
          )
            ? walletLockedBalance
            : 0,
        );

        setCurrency(
          wallet?.currency?.trim() ||
            "INR",
        );

        const history =
          historyResponse.data
            ?.transactions ?? [];

        setTransactions(
          history.map(
            (
              transaction,
              index,
            ) =>
              normalizeTransaction(
                transaction,
                index,
              ),
          ),
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load wallet.";

        const normalizedMessage =
          message.toLowerCase();

        if (
          normalizedMessage.includes(
            "unauthorized",
          ) ||
          normalizedMessage.includes(
            "invalid token",
          ) ||
          normalizedMessage.includes(
            "jwt",
          )
        ) {
          localStorage.removeItem(
            "asp_access_token",
          );

          localStorage.removeItem(
            "asp_refresh_token",
          );

          router.replace(
            `/login?redirect=${encodeURIComponent(
              "/wallet",
            )}`,
          );

          return;
        }

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-[#D4AF37]">
              My Wallet
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
              Manage your consultation balance
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-gray-600">
              Add money to your wallet and use it
              securely for chat and audio-call
              consultations with verified
              astrologers.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                loading || refreshing
              }
              onClick={() =>
                void loadWallet(true)
              }
              className="rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <Link
              href="/astrologers"
              className="inline-flex rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
            >
              Browse Astrologers
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <h2 className="font-bold">
              Unable to load wallet
            </h2>

            <p className="mt-1 text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadWallet()
              }
              className="mt-4 rounded-xl border border-red-300 px-5 py-2 font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="animate-pulse rounded-3xl bg-[#0B1026] p-8 shadow-xl">
              <div className="h-4 w-32 rounded bg-white/20" />
              <div className="mt-5 h-14 w-56 rounded bg-white/20" />
              <div className="mt-5 h-4 w-3/4 rounded bg-white/20" />
            </div>

            <div className="animate-pulse rounded-3xl bg-white p-8 shadow-lg">
              <div className="h-7 w-36 rounded bg-gray-200" />
              <div className="mt-4 h-4 w-full rounded bg-gray-200" />
              <div className="mt-7 h-14 rounded-xl bg-gray-200" />
            </div>
          </div>
        ) : (
          <>
            <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-3xl bg-[#0B1026] p-8 text-white shadow-xl">
                <p className="text-sm font-semibold text-[#D4AF37]">
                  Available Balance
                </p>

                <p className="mt-4 text-5xl font-bold">
                  ₹
                  {availableBalance.toFixed(
                    2,
                  )}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs text-gray-300">
                      Total Balance
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      ₹{balance.toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs text-gray-300">
                      Locked Balance
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      ₹
                      {lockedBalance.toFixed(
                        2,
                      )}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm text-gray-300">
                  Currency: {currency}
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-[#0B1026]">
                  Add Money
                </h2>

                <p className="mt-2 leading-7 text-gray-600">
                  Recharge your wallet securely
                  before starting a consultation.
                </p>

                <Link
                  href="/wallet/recharge"
                  className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#D4AF37] px-6 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
                >
                  Recharge Wallet
                </Link>

                <p className="mt-3 text-center text-xs text-gray-500">
                  Production recharge will be
                  verified through Razorpay.
                </p>
              </div>
            </section>

            <section className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#0B1026]">
                    Transaction History
                  </h2>

                  <p className="mt-1 text-gray-600">
                    Review wallet recharges,
                    refunds, bonuses and
                    consultation deductions.
                  </p>
                </div>

                <p className="text-sm text-gray-500">
                  {transactions.length}{" "}
                  transaction
                  {transactions.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              {transactions.length ===
              0 ? (
                <div className="mt-8 rounded-2xl border border-dashed bg-[#FAF7F0] p-10 text-center">
                  <h3 className="text-lg font-bold text-[#0B1026]">
                    No transactions yet
                  </h3>

                  <p className="mt-2 text-gray-600">
                    Your recharge and
                    consultation activity will
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {transactions.map(
                    (transaction) => (
                      <article
                        key={
                          transaction.id
                        }
                        className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                              transaction.type ===
                              "credit"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {transaction.type ===
                            "credit"
                              ? "+"
                              : "−"}
                          </span>

                          <div>
                            <p className="font-semibold text-[#0B1026]">
                              {
                                transaction.title
                              }
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              {
                                transaction.date
                              }
                            </p>
                          </div>
                        </div>

                        <p
                          className={`text-lg font-bold ${
                            transaction.type ===
                            "credit"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {transaction.type ===
                          "credit"
                            ? "+"
                            : "-"}
                          ₹
                          {transaction.amount.toFixed(
                            2,
                          )}
                        </p>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}