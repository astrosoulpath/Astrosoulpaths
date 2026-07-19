"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getWallet,
  getWalletHistory,
} from "@/services/walletService";
import {
  getConsultationHistory,
  type ConsultationSession,
} from "@/services/consultationService";

type WalletApiResponse = {
  success?: boolean;
  data?: {
    balance?: number;
    availableBalance?: number;
    lockedBalance?: number;
    currency?: string;
  };
};

type WalletHistoryResponse = {
  success?: boolean;
  data?: {
    transactions?: unknown[];
    total?: number;
  };
};

type StoredUser = {
  id?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  email?: string;
  profile?: {
    fullName?: string;
  };
  userProfile?: {
    fullName?: string;
  };
};

type DashboardAction = {
  title: string;
  description: string;
  href: string;
  icon: string;
};

const dashboardActions: DashboardAction[] = [
  {
    title: "Find Astrologers",
    description:
      "Browse verified astrologers and start a consultation.",
    href: "/astrologers",
    icon: "🔮",
  },
  {
    title: "My Consultations",
    description:
      "Continue active calls or review completed consultations.",
    href: "/consultations",
    icon: "📞",
  },
  {
    title: "Consultation History",
    description:
      "View your previous chat and audio consultation records.",
    href: "/consultations/history",
    icon: "🕘",
  },
  {
    title: "My Wallet",
    description:
      "Check your balance, transactions and recharge wallet.",
    href: "/wallet",
    icon: "👛",
  },
  {
    title: "Subscriptions",
    description:
      "Explore and manage your Astro Soul Path subscription.",
    href: "/subscriptions",
    icon: "⭐",
  },
  {
    title: "Kundli",
    description:
      "Create and manage your personal Kundli information.",
    href: "/kundli",
    icon: "📜",
  },
  {
    title: "Remedies",
    description:
      "Explore personalized spiritual guidance and remedies.",
    href: "/remedies",
    icon: "🪔",
  },
  {
    title: "Complete Profile",
    description:
      "Update your personal information and birth details.",
    href: "/profile/complete",
    icon: "👤",
  },
];

function getSafeNumber(value: unknown): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function isActiveConsultation(
  consultation: ConsultationSession,
): boolean {
  if (
    consultation.status !== "ACTIVE" ||
    consultation.endedAt
  ) {
    return false;
  }

  const expiryTime = new Date(
    consultation.expiresAt,
  ).getTime();

  return (
    Number.isFinite(expiryTime) &&
    expiryTime > Date.now()
  );
}

function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const possibleKeys = [
    "asp_user",
    "asp_auth_user",
    "user",
  ];

  for (const key of possibleKeys) {
    const storedValue =
      window.localStorage.getItem(key);

    if (!storedValue) {
      continue;
    }

    try {
      return JSON.parse(
        storedValue,
      ) as StoredUser;
    } catch {
      continue;
    }
  }

  return null;
}

function getUserDisplayName(
  user: StoredUser | null,
): string {
  const name =
    user?.fullName?.trim() ||
    user?.name?.trim() ||
    user?.profile?.fullName?.trim() ||
    user?.userProfile?.fullName?.trim();

  return name || "Astro Soul Path User";
}

export default function CustomerDashboardPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<StoredUser | null>(null);

  const [walletBalance, setWalletBalance] =
    useState(0);

  const [
    consultations,
    setConsultations,
  ] = useState<ConsultationSession[]>([]);

  const [transactionCount, setTransactionCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadDashboard = useCallback(
    async (refresh = false) => {
      const token =
        window.localStorage.getItem(
          "asp_access_token",
        );

      if (!token) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            "/dashboard",
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
        setUser(readStoredUser());

        const results =
          await Promise.allSettled([
            getWallet() as Promise<WalletApiResponse>,
            getWalletHistory() as Promise<WalletHistoryResponse>,
            getConsultationHistory(),
          ]);

        const walletResult = results[0];

        if (
          walletResult.status ===
          "fulfilled"
        ) {
          const availableBalance =
            walletResult.value.data
              ?.availableBalance ??
            walletResult.value.data?.balance ??
            0;

          setWalletBalance(
            getSafeNumber(
              availableBalance,
            ),
          );
        }

        const walletHistoryResult =
          results[1];

        if (
          walletHistoryResult.status ===
          "fulfilled"
        ) {
          const transactions =
            walletHistoryResult.value.data
              ?.transactions ?? [];

          const total =
            walletHistoryResult.value.data
              ?.total;

          setTransactionCount(
            typeof total === "number"
              ? total
              : transactions.length,
          );
        }

        const consultationResult =
          results[2];

        if (
          consultationResult.status ===
          "fulfilled"
        ) {
          const records =
            Array.isArray(
              consultationResult.value.data,
            )
              ? consultationResult.value.data
              : [];

          setConsultations(records);
        }

        const rejectedResult =
          results.find(
            (
              result,
            ): result is PromiseRejectedResult =>
              result.status ===
              "rejected",
          );

        if (rejectedResult) {
          const message =
            rejectedResult.reason instanceof
            Error
              ? rejectedResult.reason.message
              : String(
                  rejectedResult.reason ??
                    "",
                );

          const normalizedMessage =
            message.toLowerCase();

          if (
            normalizedMessage.includes(
              "login_required",
            ) ||
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
            window.localStorage.removeItem(
              "asp_access_token",
            );

            window.localStorage.removeItem(
              "asp_refresh_token",
            );

            router.replace(
              `/login?redirect=${encodeURIComponent(
                "/dashboard",
              )}`,
            );

            return;
          }

          setError(
            "Some dashboard information could not be loaded. You can still use the available options.",
          );
        }
      } catch (dashboardError: unknown) {
        const message =
          dashboardError instanceof Error
            ? dashboardError.message
            : "Unable to load dashboard.";

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeConsultations =
    useMemo(
      () =>
        consultations.filter(
          isActiveConsultation,
        ),
      [consultations],
    );

  const completedConsultations =
    useMemo(
      () =>
        consultations.filter(
          (consultation) =>
            !isActiveConsultation(
              consultation,
            ),
        ),
      [consultations],
    );

  const totalSpent = useMemo(
    () =>
      consultations.reduce(
        (total, consultation) =>
          total +
          getSafeNumber(
            consultation.amountCharged,
          ),
        0,
      ),
    [consultations],
  );

  const userName =
    getUserDisplayName(user);

  const handleLogout = () => {
    window.localStorage.removeItem(
      "asp_access_token",
    );

    window.localStorage.removeItem(
      "asp_refresh_token",
    );

    window.localStorage.removeItem(
      "asp_user",
    );

    window.localStorage.removeItem(
      "asp_auth_user",
    );

    window.localStorage.removeItem(
      "asp_active_call",
    );

    router.replace("/login");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-[#0B1026] text-white shadow-xl">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="font-semibold text-[#D4AF37]">
                Customer Dashboard
              </p>

              <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
                Welcome, {userName}
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-gray-300">
                Manage your consultations,
                wallet, subscription, Kundli and
                profile from one place.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/astrologers"
                  className="rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
                >
                  Consult an Astrologer
                </Link>

                <Link
                  href="/wallet/recharge"
                  className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Recharge Wallet
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:flex-col">
              <button
                type="button"
                disabled={
                  loading || refreshing
                }
                onClick={() =>
                  void loadDashboard(true)
                }
                className="rounded-xl border border-white/30 px-5 py-3 font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-orange-700">
            <p className="font-semibold">
              {error}
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/wallet"
            className="rounded-3xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
          >
            <p className="text-sm font-medium text-gray-500">
              Wallet Balance
            </p>

            <p className="mt-3 text-3xl font-bold text-[#0B1026]">
              {loading
                ? "..."
                : `₹${walletBalance.toFixed(
                    2,
                  )}`}
            </p>

            <p className="mt-2 text-sm font-semibold text-[#D4AF37]">
              View wallet →
            </p>
          </Link>

          <Link
            href="/consultations"
            className="rounded-3xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
          >
            <p className="text-sm font-medium text-gray-500">
              Active Consultations
            </p>

            <p className="mt-3 text-3xl font-bold text-green-600">
              {loading
                ? "..."
                : activeConsultations.length}
            </p>

            <p className="mt-2 text-sm font-semibold text-[#D4AF37]">
              Continue consultation →
            </p>
          </Link>

          <Link
            href="/consultations/history"
            className="rounded-3xl bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
          >
            <p className="text-sm font-medium text-gray-500">
              Completed Consultations
            </p>

            <p className="mt-3 text-3xl font-bold text-[#0B1026]">
              {loading
                ? "..."
                : completedConsultations.length}
            </p>

            <p className="mt-2 text-sm font-semibold text-[#D4AF37]">
              View history →
            </p>
          </Link>

          <div className="rounded-3xl bg-[#D4AF37] p-6 shadow-lg">
            <p className="text-sm font-medium text-[#0B1026]/70">
              Total Consultation Spend
            </p>

            <p className="mt-3 text-3xl font-bold text-[#0B1026]">
              {loading
                ? "..."
                : `₹${totalSpent.toFixed(
                    2,
                  )}`}
            </p>

            <p className="mt-2 text-sm font-semibold text-[#0B1026]/70">
              {transactionCount} wallet
              transaction
              {transactionCount === 1
                ? ""
                : "s"}
            </p>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-semibold text-[#D4AF37]">
                Quick Access
              </p>

              <h2 className="mt-2 text-3xl font-bold text-[#0B1026]">
                Everything you need
              </h2>
            </div>

            <p className="max-w-xl text-gray-600">
              Access all customer services from
              your personalized dashboard.
            </p>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardActions.map(
              (action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-3xl border border-transparent bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-xl"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF7F0] text-3xl transition group-hover:bg-[#D4AF37]/20">
                    {action.icon}
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-[#0B1026]">
                    {action.title}
                  </h3>

                  <p className="mt-2 leading-6 text-gray-600">
                    {action.description}
                  </p>

                  <p className="mt-5 font-semibold text-[#D4AF37]">
                    Open →
                  </p>
                </Link>
              ),
            )}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-7 shadow-lg sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#0B1026]">
                  Consultation Overview
                </h2>

                <p className="mt-2 text-gray-600">
                  Track your recent astrology
                  consultation activity.
                </p>
              </div>

              <Link
                href="/consultations"
                className="rounded-xl border border-[#D4AF37] px-5 py-2.5 font-semibold text-[#0B1026]"
              >
                View All
              </Link>
            </div>

            {loading ? (
              <div className="mt-7 space-y-4">
                {[1, 2, 3].map(
                  (item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-2xl bg-gray-100"
                    />
                  ),
                )}
              </div>
            ) : consultations.length ===
              0 ? (
              <div className="mt-7 rounded-2xl border border-dashed border-gray-300 bg-[#FAF7F0] p-8 text-center">
                <h3 className="text-lg font-bold text-[#0B1026]">
                  No consultations yet
                </h3>

                <p className="mt-2 text-gray-600">
                  Book your first consultation
                  with a verified astrologer.
                </p>

                <Link
                  href="/astrologers"
                  className="mt-5 inline-flex rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026]"
                >
                  Browse Astrologers
                </Link>
              </div>
            ) : (
              <div className="mt-7 space-y-4">
                {consultations
                  .slice(0, 3)
                  .map(
                    (consultation) => {
                      const active =
                        isActiveConsultation(
                          consultation,
                        );

                      return (
                        <article
                          key={
                            consultation.id
                          }
                          className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <h3 className="font-bold text-[#0B1026]">
                              {consultation
                                .astrologer
                                ?.userProfile
                                ?.fullName ||
                                "Astro Soul Path Astrologer"}
                            </h3>

                            <p className="mt-1 text-sm text-gray-500">
                              {active
                                ? "Active consultation"
                                : "Completed consultation"}
                            </p>
                          </div>

                          <Link
                            href="/consultations"
                            className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
                              active
                                ? "bg-green-100 text-green-700"
                                : "bg-[#FAF7F0] text-[#0B1026]"
                            }`}
                          >
                            {active
                              ? "Continue"
                              : "View Details"}
                          </Link>
                        </article>
                      );
                    },
                  )}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-[#0B1026] p-7 text-white shadow-lg sm:p-8">
            <p className="font-semibold text-[#D4AF37]">
              Need Guidance?
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Talk to a verified astrologer
            </h2>

            <p className="mt-4 leading-7 text-gray-300">
              Connect through secure chat or
              audio consultation and receive
              personalized guidance.
            </p>

            <div className="mt-7 space-y-3">
              <Link
                href="/astrologers"
                className="flex w-full justify-center rounded-xl bg-[#D4AF37] px-6 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
              >
                Find Astrologers
              </Link>

              <Link
                href="/wallet/recharge"
                className="flex w-full justify-center rounded-xl border border-white/30 px-6 py-4 font-semibold text-white transition hover:bg-white/10"
              >
                Recharge Wallet
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}