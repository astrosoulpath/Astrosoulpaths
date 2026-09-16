"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { KundliResult } from "@/features/kundli/KundliResult";
import {
  downloadSavedKundliPdf,
  getSavedKundli,
  KundliApiError,
  type SavedKundliDetail,
} from "@/services/kundliService";

export default function SavedKundliDetailPage() {
  const router = useRouter();

  const params = useParams<{
    savedRecordId: string;
  }>();

  const savedRecordId =
    typeof params.savedRecordId === "string" ? params.savedRecordId : "";

  const [detail, setDetail] = useState<SavedKundliDetail | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [downloadError, setDownloadError] = useState("");

  const loadKundli = useCallback(async () => {
    if (!savedRecordId) {
      setError("Saved Kundli record ID is missing.");

      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setDownloadError("");

      const response = await getSavedKundli(savedRecordId);

      setDetail(response.data);
    } catch (err: unknown) {
      if (err instanceof KundliApiError) {
        if (err.code === "LOGIN_REQUIRED") {
          router.replace(
            `/astrologer/login?redirect=${encodeURIComponent(
              `/astrologer/kundli/saved/${savedRecordId}`,
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
            "An active Professional Kundli yearly subscription is required to view this record.",
          );

          return;
        }

        if (err.code === "ASTROLOGER_ACCESS_REQUIRED") {
          setError(
            "This professional Kundli is available only to verified astrologers.",
          );

          return;
        }

        if (err.code === "SAVED_KUNDLI_NOT_FOUND") {
          setError(
            "This saved Kundli was not found or does not belong to your astrologer account.",
          );

          return;
        }

        if (err.code === "KUNDLI_REPORT_NOT_FOUND") {
          setError(
            "The Kundli record exists, but its report data is unavailable.",
          );

          return;
        }

        setError(err.message);
        return;
      }

      setError(
        err instanceof Error ? err.message : "Unable to load the saved Kundli.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, savedRecordId]);

  useEffect(() => {
    void loadKundli();
  }, [loadKundli]);

  async function handleDownloadPdf() {
    if (!savedRecordId || downloadingPdf) {
      return;
    }

    try {
      setDownloadingPdf(true);
      setDownloadError("");

      await downloadSavedKundliPdf(savedRecordId);
    } catch (err: unknown) {
      if (err instanceof KundliApiError) {
        if (err.code === "LOGIN_REQUIRED") {
          router.replace(
            `/astrologer/login?redirect=${encodeURIComponent(
              `/astrologer/kundli/saved/${savedRecordId}`,
            )}`,
          );

          return;
        }

        if (err.code === "ASTROLOGER_APPROVAL_REQUIRED") {
          router.replace("/astrologer/pending");

          return;
        }

        if (err.code === "KUNDLI_SUBSCRIPTION_REQUIRED") {
          setDownloadError(
            "An active Professional Kundli yearly subscription is required to download this PDF.",
          );

          return;
        }

        if (err.code === "SAVED_KUNDLI_NOT_FOUND") {
          setDownloadError(
            "This saved Kundli was not found or does not belong to your astrologer account.",
          );

          return;
        }

        setDownloadError(err.message);
        return;
      }

      setDownloadError(
        err instanceof Error
          ? err.message
          : "Unable to download the Kundli PDF.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-5 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/astrologer/kundli/saved"
            className="inline-flex w-fit items-center rounded-full border border-[#0B1026] px-5 py-2.5 text-sm font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
          >
            ← Saved Kundlis
          </Link>

          <div className="flex flex-wrap gap-3">
            {detail && !loading && !error && (
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => {
                  void handleDownloadPdf();
                }}
                className="inline-flex w-fit rounded-full border border-[#D4AF37] px-6 py-2.5 text-sm font-bold text-[#0B1026] transition hover:bg-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloadingPdf ? "Generating PDF..." : "Download PDF"}
              </button>
            )}

            <Link
              href="/astrologer/kundli"
              className="inline-flex w-fit rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Generate New Kundli
            </Link>
          </div>
        </div>

        {downloadError && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">PDF download failed</p>

            <p className="mt-1">{downloadError}</p>
          </div>
        )}

        {loading && (
          <section className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
            <div className="animate-pulse">
              <div className="h-7 w-64 rounded bg-gray-200" />

              <div className="mt-4 h-4 w-96 max-w-full rounded bg-gray-200" />

              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({
                  length: 4,
                }).map((_, index) => (
                  <div key={index} className="h-28 rounded-2xl bg-gray-200" />
                ))}
              </div>

              <div className="mt-8 h-96 rounded-3xl bg-gray-200" />
            </div>
          </section>
        )}

        {!loading && error && (
          <section
            role="alert"
            className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700"
          >
            <h1 className="text-2xl font-bold">Unable to open saved Kundli</h1>

            <p className="mt-3 leading-7">{error}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void loadKundli();
                }}
                className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-semibold transition hover:bg-red-100"
              >
                Try Again
              </button>

              <Link
                href="/astrologer/kundli/saved"
                className="rounded-full bg-[#0B1026] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Return to Saved Kundlis
              </Link>

              <Link
                href="/subscriptions"
                className="rounded-full border border-[#0B1026] px-5 py-2.5 text-sm font-semibold text-[#0B1026]"
              >
                View Subscription Plans
              </Link>
            </div>
          </section>
        )}

        {!loading && !error && detail && (
          <>
            <section className="mt-8 rounded-3xl border border-[#D4AF37]/25 bg-white p-6 shadow-sm sm:p-8">
              <p className="font-semibold uppercase tracking-[0.18em] text-[#B58A12]">
                Saved customer record
              </p>

              <h1 className="mt-3 text-3xl font-bold text-[#0B1026]">
                {detail.kundli.name ?? "Professional Kundli"}
              </h1>

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-[#FAF7F0] px-4 py-2 font-semibold text-[#0B1026]">
                  {detail.kundli.birthPlace ?? "Birth place unavailable"}
                </span>

                <span className="rounded-full bg-[#FAF7F0] px-4 py-2 font-semibold text-[#0B1026]">
                  {detail.kundli.lang.toUpperCase()}
                </span>

                <span className="rounded-full bg-[#FAF7F0] px-4 py-2 font-semibold text-[#0B1026]">
                  Saved report
                </span>
              </div>
            </section>

            <div id="kundli-result" className="mt-8 scroll-mt-28">
              <KundliResult result={detail.kundli} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
