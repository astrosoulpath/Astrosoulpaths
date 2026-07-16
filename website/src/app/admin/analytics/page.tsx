"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

type AnalyticsData = {
  totalCustomers?: number;
  totalAstrologers?: number;
  approvedAstrologers?: number;
  activeConsultations?: number;
  completedConsultations?: number;
  totalRevenue?: number;
  totalWalletBalance?: number;
  totalPayments?: number;
  successfulPayments?: number;
  subscriptions?: number;
};

function getToken() {
  return (
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

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

      const token = getToken();

      if (!token) {
        throw new Error(
          "Admin login token is missing.",
        );
      }

      const response = await fetch(
        `${API_BASE_URL.replace(
          /\/+$/,
          "",
        )}/admin/analytics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Unable to load analytics.",
        );
      }

      setData(result?.data ?? {});
    } catch (caughtError) {
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

  const cards = [
    ["Total Customers", data.totalCustomers ?? 0],
    [
      "Total Astrologers",
      data.totalAstrologers ?? 0,
    ],
    [
      "Approved Astrologers",
      data.approvedAstrologers ?? 0,
    ],
    [
      "Active Consultations",
      data.activeConsultations ?? 0,
    ],
    [
      "Completed Consultations",
      data.completedConsultations ?? 0,
    ],
    [
      "Total Revenue",
      `₹${Number(
        data.totalRevenue ?? 0,
      ).toFixed(2)}`,
    ],
    [
      "Wallet Balance",
      `₹${Number(
        data.totalWalletBalance ?? 0,
      ).toFixed(2)}`,
    ],
    ["Total Payments", data.totalPayments ?? 0],
    [
      "Successful Payments",
      data.successfulPayments ?? 0,
    ],
    ["Subscriptions", data.subscriptions ?? 0],
  ];

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Admin Panel
            </p>

            <h1 className="mt-2 text-4xl font-extrabold text-[#0B1026]">
              Platform Analytics
            </h1>

            <p className="mt-3 text-gray-600">
              Review platform growth, consultation,
              payment and subscription performance.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void loadAnalytics()}
              className="rounded-xl bg-[#0B1026] px-5 py-3 font-bold text-white"
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
          <div className="py-24 text-center font-semibold text-gray-600">
            Loading analytics...
          </div>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <article
                key={String(label)}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-500">
                  {label}
                </p>

                <p className="mt-4 text-3xl font-extrabold text-[#0B1026]">
                  {value}
                </p>
              </article>
            ))}
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-extrabold text-[#0B1026]">
            Analytics Overview
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            Detailed charts, date filters and downloadable
            analytics can be connected when the backend
            analytics endpoint returns grouped daily or
            monthly datasets.
          </p>
        </section>
      </div>
    </main>
  );
}