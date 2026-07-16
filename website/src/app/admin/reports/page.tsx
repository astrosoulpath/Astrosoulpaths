"use client";

import Link from "next/link";
import { useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

type ReportType =
  | "CUSTOMERS"
  | "ASTROLOGERS"
  | "CONSULTATIONS"
  | "PAYMENTS"
  | "WALLETS"
  | "SUBSCRIPTIONS";

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

export default function AdminReportsPage() {
  const [reportType, setReportType] =
    useState<ReportType>("CONSULTATIONS");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<
    "CSV" | "PDF"
  >("CSV");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generateReport() {
    try {
      setLoading(true);
      setMessage("");

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
        )}/admin/reports`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            format,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Unable to generate report (${response.status}).`,
        );
      }

      setMessage(
        data?.message ||
          "Report generated successfully.",
      );

      if (data?.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate report.",
      );
    } finally {
      setLoading(false);
    }
  }

  const reportCards = [
    {
      title: "Customer Report",
      description:
        "Registered customers, account activity and wallet summary.",
      type: "CUSTOMERS" as const,
    },
    {
      title: "Astrologer Report",
      description:
        "Approval, verification, rating and earning details.",
      type: "ASTROLOGERS" as const,
    },
    {
      title: "Consultation Report",
      description:
        "Active, completed, cancelled and expired sessions.",
      type: "CONSULTATIONS" as const,
    },
    {
      title: "Payment Report",
      description:
        "Successful, pending, failed and refunded payments.",
      type: "PAYMENTS" as const,
    },
    {
      title: "Wallet Report",
      description:
        "Wallet balances, locked funds and ledger activity.",
      type: "WALLETS" as const,
    },
    {
      title: "Subscription Report",
      description:
        "Active plans, renewals, expiry and revenue.",
      type: "SUBSCRIPTIONS" as const,
    },
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
              Reports
            </h1>

            <p className="mt-3 text-gray-600">
              Generate operational and financial reports
              for platform administration.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reportCards.map((report) => (
            <button
              key={report.type}
              type="button"
              onClick={() =>
                setReportType(report.type)
              }
              className={`rounded-2xl border p-6 text-left shadow-sm transition ${
                reportType === report.type
                  ? "border-[#D4AF37] bg-amber-50"
                  : "border-gray-200 bg-white hover:border-[#D4AF37]"
              }`}
            >
              <h2 className="text-xl font-extrabold text-[#0B1026]">
                {report.title}
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {report.description}
              </p>
            </button>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-extrabold text-[#0B1026]">
            Generate Report
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[#0B1026]">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-[#0B1026]">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-[#0B1026]">
                Report type
              </label>
              <select
                value={reportType}
                onChange={(event) =>
                  setReportType(
                    event.target.value as ReportType,
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                {reportCards.map((report) => (
                  <option
                    key={report.type}
                    value={report.type}
                  >
                    {report.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-[#0B1026]">
                Export format
              </label>
              <select
                value={format}
                onChange={(event) =>
                  setFormat(
                    event.target.value as
                      | "CSV"
                      | "PDF",
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                <option value="CSV">CSV</option>
                <option value="PDF">PDF</option>
              </select>
            </div>
          </div>

          {message ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void generateReport()}
            disabled={loading}
            className="mt-6 rounded-xl bg-[#D4AF37] px-6 py-4 font-bold text-[#0B1026] disabled:opacity-50"
          >
            {loading
              ? "Generating Report..."
              : `Generate ${format} Report`}
          </button>
        </section>
      </div>
    </main>
  );
}