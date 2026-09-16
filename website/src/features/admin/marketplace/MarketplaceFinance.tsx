"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Earning = {
  id: string;
  currency?: string;
  grossAmount?: string | number;
  platformFeePercent?: string | number;
  platformFeeAmount?: string | number;
  netAmount?: string | number;
  status?: string;
  createdAt?: string;
  availableAt?: string | null;
  paidAt?: string | null;
  sellerOrder?: {
    order?: {
      orderNumber?: string;
      status?: string;
    };
  };
};

type EarningSummary = {
  status?: string;
  currency?: string;
  _sum?: {
    grossAmount?: string | number | null;
    platformFeeAmount?: string | number | null;
    netAmount?: string | number | null;
  };
  _count?: {
    _all?: number;
  };
};

type FinanceEnvelope = {
  summary?: EarningSummary[];
  earnings?: Earning[];
};

type Payout = {
  id: string;
  currency?: string;
  amount?: string | number;
  status?: string;
  createdAt?: string;
  processedAt?: string | null;
  completedAt?: string | null;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:4000";

function getAccessToken() {
  if (typeof window === "undefined") return "";

  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.sessionStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("access_token") ??
    ""
  ).trim();
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;

  const source = body as Record<string, unknown>;
  const message = source.message;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (Array.isArray(message) && message.length > 0) {
    return message.map(String).join(", ");
  }

  if (typeof source.error === "string" && source.error.trim()) {
    return source.error.trim();
  }

  return fallback;
}

function money(value: unknown, currency?: string) {
  if (value === null || value === undefined || value === "") {
    return `${currency || "INR"} 0`;
  }

  return `${currency || "INR"} ${String(value)}`;
}

function statusClass(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "AVAILABLE":
    case "PAID":
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "PENDING":
    case "PAYOUT_REQUESTED":
    case "REQUESTED":
    case "PROCESSING":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";

    case "FAILED":
    case "CANCELLED":
    case "REVERSED":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-600 bg-slate-800 text-slate-300";
  }
}

export function MarketplaceFinance() {
  const [finance, setFinance] = useState<FinanceEnvelope>({
    summary: [],
    earnings: [],
  });

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const earnings = useMemo(
    () => (Array.isArray(finance.earnings) ? finance.earnings : []),
    [finance],
  );

  const summary = useMemo(
    () => (Array.isArray(finance.summary) ? finance.summary : []),
    [finance],
  );

  const load = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setLoading(false);
      setError("Admin session missing. Please login again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [earningsResponse, payoutsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/marketplace/earnings`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
        fetch(`${API_BASE_URL}/admin/marketplace/payouts`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
      ]);

      const earningsBody = (await earningsResponse
        .json()
        .catch(() => null)) as ApiEnvelope<FinanceEnvelope> | null;

      const payoutsBody = (await payoutsResponse
        .json()
        .catch(() => null)) as ApiEnvelope<Payout[]> | null;

      if (!earningsResponse.ok) {
        throw new Error(
          errorMessage(earningsBody, "Unable to load marketplace earnings."),
        );
      }

      if (!payoutsResponse.ok) {
        throw new Error(
          errorMessage(payoutsBody, "Unable to load marketplace payouts."),
        );
      }

      setFinance({
        summary: Array.isArray(earningsBody?.data?.summary)
          ? earningsBody.data.summary
          : [],
        earnings: Array.isArray(earningsBody?.data?.earnings)
          ? earningsBody.data.earnings
          : [],
      });

      setPayouts(Array.isArray(payoutsBody?.data) ? payoutsBody.data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load marketplace finance.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-400">
            Marketplace Finance
          </p>

          <h3 className="mt-2 text-2xl font-black">Earnings & Payouts</h3>

          <p className="mt-2 text-sm text-slate-400">
            Read-only marketplace accounting and payout history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl bg-amber-400 px-4 py-2 font-black text-black disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
          <p className="text-sm text-slate-400">Earnings</p>
          <p className="mt-2 text-3xl font-black">{earnings.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
          <p className="text-sm text-slate-400">Payouts</p>
          <p className="mt-2 text-3xl font-black">{payouts.length}</p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-slate-950 p-5">
          <p className="text-sm text-slate-400">Summary Groups</p>
          <p className="mt-2 text-3xl font-black text-amber-300">
            {summary.length}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-xl border border-red-500/30 p-4 text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-slate-400">Loading marketplace finance...</p>
      ) : null}

      {!loading && !error ? (
        <>
          <section>
            <h4 className="mb-3 text-lg font-black text-white">
              Earning History
            </h4>

            {earnings.length === 0 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-8 text-center">
                <p className="font-black">No marketplace earnings yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  Earnings appear only after verified marketplace payment
                  accounting exists.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {earnings.map((earning) => {
                  const currency = earning.currency || "INR";

                  return (
                    <article
                      key={earning.id}
                      className="rounded-2xl border border-slate-700 bg-slate-950 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-black">
                            {earning.sellerOrder?.order?.orderNumber ||
                              "Marketplace earning"}
                          </p>

                          <p className="mt-2 text-sm text-slate-400">
                            Gross: {money(earning.grossAmount, currency)}
                          </p>

                          <p className="text-sm text-slate-400">
                            Platform fee:{" "}
                            {money(earning.platformFeeAmount, currency)}
                          </p>

                          <p className="mt-1 font-black text-amber-300">
                            Net: {money(earning.netAmount, currency)}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                            earning.status,
                          )}`}
                        >
                          {(earning.status || "PENDING").replaceAll("_", " ")}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h4 className="mb-3 text-lg font-black text-white">
              Payout History
            </h4>

            {payouts.length === 0 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-8 text-center">
                <p className="font-black">No marketplace payouts yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  Payout records will appear here when they exist.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout) => (
                  <article
                    key={payout.id}
                    className="rounded-2xl border border-slate-700 bg-slate-950 p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <p className="font-black text-amber-300">
                        {money(payout.amount, payout.currency || "INR")}
                      </p>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                          payout.status,
                        )}`}
                      >
                        {(payout.status || "REQUESTED").replaceAll("_", " ")}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <p className="mt-6 text-xs text-slate-500">
        This screen does not execute payments, refunds or payouts.
      </p>
    </div>
  );
}
