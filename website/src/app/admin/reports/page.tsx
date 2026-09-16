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
    window.localStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

export default function AdminReportsPage() {
  const [reportType, setReportType] =
    useState<ReportType>("CONSULTATIONS");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<"XLSX" | "CSV">("XLSX");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generateReport() {
    try {
      setLoading(true);
      setMessage("");

      if (!startDate || !endDate) {
        throw new Error(
          "Please select both start date and end date.",
        );
      }

      if (startDate > endDate) {
        throw new Error(
          "Start date cannot be after end date.",
        );
      }

      const token = getToken();

      if (!token) {
        throw new Error(
          "Admin login token is missing. Please log in again.",
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
            Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportType,
            startDate,
            endDate,
            format,
          }),
        },
      );

      if (!response.ok) {
        const contentType =
          response.headers.get(
            "content-type",
          );

        if (
          contentType?.includes(
            "application/json",
          )
        ) {
          const body =
            await response.json();

          throw new Error(
            body?.message ||
              `Unable to generate report (${response.status}).`,
          );
        }

        const text =
          await response.text();

        throw new Error(
          text ||
            `Unable to generate report (${response.status}).`,
        );
      }

      const blob = await response.blob();

      const disposition =
        response.headers.get(
          "content-disposition",
        );

      const filenameMatch =
        disposition?.match(
          /filename="?([^"]+)"?/i,
        );

      const extension =
        format === "XLSX"
          ? "xlsx"
          : "csv";

      const filename =
        filenameMatch?.[1] ||
        `AstroSoulPath_${reportType}_Report.${extension}`;

      const url =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      const count =
        response.headers.get(
          "x-report-records",
        );

      setMessage(
        count
          ? `Premium report generated successfully. ${count} record(s) exported.`
          : "Premium report generated successfully.",
      );
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
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="mt-2 text-4xl font-extrabold text-[#0B1026]">
              Reports
            </h1>

            <p className="asp-admin-subtitle mt-3">
              Generate operational and financial reports
              for platform administration.
            </p>
          </div>

          <Link
            href="/admin"
            className="asp-admin-back-btn"
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

              <p className="mt-3 text-sm leading-6 text-[#4B5C73]">
                {report.description}
              </p>
            </button>
          ))}
        </section>

        <section className="mt-8 asp-admin-panel p-6 sm:p-8">
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
                className="mt-2 asp-admin-input w-full px-4 py-3"
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
                className="mt-2 asp-admin-input w-full px-4 py-3"
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
                className="mt-2 asp-admin-input w-full bg-white px-4 py-3"
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
                    event.target.value as "XLSX" | "CSV",
                  )
                }
                className="mt-2 asp-admin-input w-full bg-white px-4 py-3"
              >
                <option value="XLSX">Premium Excel (.xlsx)</option>
<option value="CSV">CSV - Raw Data</option>
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
            className="asp-admin-gold-btn mt-6 px-6 py-4 disabled:opacity-50"
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








