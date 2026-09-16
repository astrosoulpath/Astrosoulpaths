"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  getSavedKundlis,
  KundliApiError,
  type SavedKundliSummary,
} from "@/services/kundliService";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SavedKundlisPage() {
  const router = useRouter();

  const [records, setRecords] = useState<SavedKundliSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getSavedKundlis();

      setRecords(response.data);
    } catch (err: unknown) {
      if (err instanceof KundliApiError) {
        if (err.code === "LOGIN_REQUIRED") {
          router.replace(
            `/astrologer/login?redirect=${encodeURIComponent(
              "/astrologer/kundli/saved",
            )}`,
          );
          return;
        }

        if (err.code === "ASTROLOGER_APPROVAL_REQUIRED") {
          router.replace("/astrologer/pending");
          return;
        }

        if (err.code === "KUNDLI_SUBSCRIPTION_REQUIRED") {
          setError(
            "An active Professional Kundli yearly subscription is required to access saved customer Kundlis.",
          );
          return;
        }

        if (err.code === "ASTROLOGER_ACCESS_REQUIRED") {
          setError(
            "Saved professional Kundlis are available only to verified astrologers.",
          );
          return;
        }

        setError(err.message);
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load saved Kundli records.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-5 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-[#B58A12]">
              Professional Kundli
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
              Saved customer Kundlis
            </h1>

            <p className="mt-3 max-w-2xl leading-7 text-gray-600">
              Access Kundlis generated and saved through your astrologer
              account.
            </p>
          </div>

          <Link
            href="/astrologer/kundli"
            className="rounded-full bg-[#D4AF37] px-6 py-3 text-center font-bold text-[#0B1026] transition hover:bg-[#C9A52F]"
          >
            Generate New Kundli
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
          >
            <p className="font-semibold">Unable to load saved Kundlis</p>

            <p className="mt-2 text-sm">{error}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void loadRecords();
                }}
                className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold transition hover:bg-red-100"
              >
                Try Again
              </button>

              <Link
                href="/subscriptions"
                className="rounded-full bg-[#0B1026] px-5 py-2 text-sm font-semibold text-white"
              >
                View Subscription Plans
              </Link>
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-3xl bg-white shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <section className="mt-8 rounded-3xl border border-[#D4AF37]/25 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-[#0B1026]">
              No saved Kundlis yet
            </h2>

            <p className="mx-auto mt-3 max-w-xl leading-7 text-gray-600">
              Generate your first customer Kundli. It will automatically appear
              here.
            </p>

            <Link
              href="/astrologer/kundli"
              className="mt-6 inline-flex rounded-full bg-[#D4AF37] px-7 py-3 font-bold text-[#0B1026]"
            >
              Generate Kundli
            </Link>
          </section>
        )}

        {!loading && !error && records.length > 0 && (
          <>
            <div className="mt-8 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600">
                {records.length} saved{" "}
                {records.length === 1 ? "record" : "records"}
              </p>
            </div>

            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {records.map((record) => (
                <article
                  key={record.id}
                  className="flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#D4AF37]/60 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B58A12]">
                        Customer Kundli
                      </p>

                      <h2 className="mt-2 text-xl font-bold text-[#0B1026]">
                        {record.name}
                      </h2>
                    </div>

                    <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-semibold text-[#8A6800]">
                      {record.lang.toUpperCase()}
                    </span>
                  </div>

                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Date of birth</dt>

                      <dd className="font-semibold text-[#0B1026]">
                        {record.kundli.dob}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Time of birth</dt>

                      <dd className="font-semibold text-[#0B1026]">
                        {record.kundli.tob}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Gender</dt>

                      <dd className="font-semibold text-[#0B1026]">
                        {record.gender}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Birth place</dt>

                      <dd className="max-w-[60%] text-right font-semibold text-[#0B1026]">
                        {record.birthPlace}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-5 text-xs text-gray-500">
                    Saved {formatDate(record.createdAt)}
                  </p>

                  <Link
                    href={`/astrologer/kundli/saved/${record.id}`}
                    className="mt-6 rounded-full border border-[#0B1026] px-5 py-2.5 text-center text-sm font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
                  >
                    View Kundli
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
