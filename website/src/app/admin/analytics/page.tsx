"use client";

import { adminFetch } from "@/features/admin/auth/admin-session";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";



type AnalyticsData = {
  totalCustomers?: number;
  totalAstrologers?: number;
  approvedAstrologers?: number;
  activeConsultations?: number;
  completedConsultations?: number;
  collections?: Array<{currency:string;amount:number|string|null}>;
  wallets?: Array<{currency:string;amount:number|string|null}>;
  totalPayments?: number;
  successfulPayments?: number;
  subscriptions?: number;
};



export default function AdminAnalyticsPage() {
  const [data, setData] =
    useState<AnalyticsData>({});
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminFetch(
        `/admin/stats`,
        {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || result?.success !== true || !result?.data) {
        throw new Error(
          result?.message ||
            "Unable to load analytics.",
        );
      }

      const stats = result.data;
      setData({totalCustomers:stats.users?.total,totalAstrologers:stats.astrologers?.total,
        approvedAstrologers:stats.astrologers?.approved,totalPayments:stats.payments?.totalOrders,
        successfulPayments:stats.payments?.successfulOrders,collections:stats.payments?.successfulAmountByCurrency,
        wallets:stats.wallets?.totalBalanceByCurrency});
    } catch (caughtError) {
      setData({});
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const money = (rows?: Array<{currency:string;amount:number|string|null}>) => {
    if (!rows) return "Unavailable";
    if (!rows.length) return "No records";
    return rows.map(({currency,amount}) => amount !== null && /^[A-Z]{3}$/.test(currency) && Number.isFinite(Number(amount))
      ? new Intl.NumberFormat("en",{style:"currency",currency,currencyDisplay:"code"}).format(Number(amount)) : "Unavailable").join(" / ");
  };
  const cards = [
    ["Total Users", data.totalCustomers ?? "Unavailable"],
    ["Total Astrologers", data.totalAstrologers ?? "Unavailable"],
    ["Approved Astrologers", data.approvedAstrologers ?? "Unavailable"],
    ["Successful Payment Collections", money(data.collections)],
    ["Wallet Balance", money(data.wallets)],
    ["Total Payments", data.totalPayments ?? "Unavailable"],
    ["Successful Payments", data.successfulPayments ?? "Unavailable"],
  ];

  return (
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="mt-2 text-4xl font-semibold text-[#0B1026]">
              Platform Analytics
            </h1>

            <p className="asp-admin-subtitle mt-3">
              Review platform growth, consultation,
              payment and subscription performance.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin"
              className="asp-admin-back-btn"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void loadAnalytics()}
              className="asp-admin-primary-btn"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-24 text-center font-semibold text-[#4B5C73]">
            Loading analytics...
          </div>
        ) : error ? null : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <article
                key={String(label)}
                className="asp-admin-stat-card"
              >
                <p className="asp-admin-stat-label">
                  {label}
                </p>

                <p className="mt-4 text-3xl font-semibold text-[#0B1026]">
                  {value}
                </p>
              </article>
            ))}
          </section>
        )}

        <section className="asp-admin-panel mt-8 p-8">
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Analytics Overview
          </h2>

          <p className="mt-3 leading-7 text-[#4B5C73]">
            Amounts are displayed in their recorded currencies.
            Payment collections do not confirm bank settlement.
          </p>
        </section>
      </div>
    </main>
  );
}

