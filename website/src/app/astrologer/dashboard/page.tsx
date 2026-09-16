"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getCurrentAstrologerConsultation,
  acceptConsultation,
  rejectConsultation,
  type ConsultationSession,
} from "@/services/consultationService";

import {
  getAstrologerDashboard,
  updateAstrologerStatus,
  type AstrologerDashboardData,
} from "@/services/astrologerDashboardService";

export default function AstrologerDashboardPage() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<AstrologerDashboardData | null>(
    null,
  );

  const [consultation, setConsultation] = useState<ConsultationSession | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [consultationActionLoading, setConsultationActionLoading] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const response = await getAstrologerDashboard();
      const astrologerDashboard = response.data;

      if (!astrologerDashboard) {
        router.replace("/astrologer/login");
        return;
      }

      if (!astrologerDashboard.isApproved || !astrologerDashboard.isVerified) {
        window.localStorage.setItem("astrologerStatus", "PENDING");

        router.replace("/astrologer/pending");
        return;
      }

      window.localStorage.setItem("astrologerStatus", "APPROVED");

      window.localStorage.setItem("accountRole", "ASTROLOGER");

      setDashboard(astrologerDashboard);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to load astrologer dashboard.";

      const normalizedMessage = errorMessage.toLowerCase();

      if (
        normalizedMessage.includes("unauthorized") ||
        normalizedMessage.includes("forbidden") ||
        normalizedMessage.includes("token") ||
        normalizedMessage.includes("session is missing") ||
        normalizedMessage.includes("401") ||
        normalizedMessage.includes("403")
      ) {
        router.replace("/astrologer/login");
        return;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function loadIncomingConsultation() {
    try {
      const response = await getCurrentAstrologerConsultation();

      setConsultation(response.data ?? null);
    } catch (err) {
      console.error("Consultation load error:", err);
    }
  }

  useEffect(() => {
    void loadDashboard();
    void loadIncomingConsultation();

    const timer = window.setInterval(() => {
      void loadIncomingConsultation();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function handleStatusChange(nextStatus: boolean) {
    try {
      setIsUpdating(true);
      setError("");
      setMessage("");

      const response = await updateAstrologerStatus(nextStatus);

      const updatedStatus = response.data?.isOnline ?? nextStatus;

      setDashboard((currentDashboard) => {
        if (!currentDashboard) {
          return currentDashboard;
        }

        return {
          ...currentDashboard,
          isOnline: Boolean(updatedStatus),
        };
      });

      setMessage(
        updatedStatus
          ? "You are now online and available for consultations."
          : "You are now offline.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update astrologer status.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAccept() {
    if (!consultation) {
      return;
    }

    try {
      setConsultationActionLoading(true);
      setError("");
      setMessage("");

      const response = await acceptConsultation(consultation.id);

      const chatSessionId = response.data?.id;

      if (!chatSessionId) {
        throw new Error(
          "Consultation accepted, but chat session ID was not returned.",
        );
      }

      setConsultation(null);

      router.push(`/chat/${chatSessionId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to accept consultation.",
      );
    } finally {
      setConsultationActionLoading(false);
    }
  }

  async function handleReject() {
    if (!consultation) {
      return;
    }

    try {
      setConsultationActionLoading(true);
      setError("");
      setMessage("");

      await rejectConsultation(consultation.id);

      setConsultation(null);

      setMessage("Consultation request rejected.");

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reject consultation.",
      );
    } finally {
      setConsultationActionLoading(false);
    }
  }

  const isOnline = dashboard?.isOnline ?? false;

  const consultationStatus =
  consultation?.status?.toUpperCase() ?? "";

  const isPendingConsultation =
  consultationStatus === "PENDING";

const isActiveConsultation =
  consultationStatus === "ACTIVE" ||
  consultationStatus === "ACCEPTED" ||
  consultationStatus === "ONGOING";

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-5 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Astrologer Panel
            </p>

            <h1 className="mt-3 text-4xl font-extrabold text-[#0B1026]">
              Astrologer Dashboard
            </h1>

            <p className="mt-2 text-gray-600">
              Welcome to Astro Soul Path Professional Panel
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Live Availability</p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span
                className={`h-3 w-3 rounded-full ${
                  isOnline ? "bg-green-500" : "bg-gray-400"
                }`}
              />

              <span className="font-semibold">
                {isOnline ? "Online" : "Offline"}
              </span>

              <button
                type="button"
                onClick={() => void handleStatusChange(!isOnline)}
                disabled={isUpdating || loading || !dashboard}
                className={`rounded-xl px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  isOnline ? "bg-red-600" : "bg-green-600"
                }`}
              >
                {isUpdating
                  ? "Updating..."
                  : isOnline
                    ? "Go Offline"
                    : "Go Online"}
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {isOnline
                ? "You are ready to receive chat and audio consultation requests."
                : "You are not visible for live consultations right now."}
            </p>
          </div>
        </div>

        {message ? (
          <div className="mt-6 rounded-2xl bg-green-50 p-4 text-green-700 shadow-sm">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow">
            Loading astrologer dashboard...
          </div>
        ) : null}

        {consultation ? (
  <section className="mt-8 rounded-3xl border border-amber-200 bg-white p-8 shadow">
    <p className="text-sm font-bold uppercase tracking-[0.15em] text-amber-600">
      {isPendingConsultation
        ? "New Request"
        : "Current Consultation"}
    </p>

    <h2 className="mt-2 text-2xl font-bold text-[#0B1026]">
      {isPendingConsultation
        ? "Incoming Consultation Request"
        : "Consultation In Progress"}
    </h2>

    <p className="mt-4 text-gray-600">
      {isPendingConsultation
        ? "A customer has requested a consultation. Accept the request to open the consultation session."
        : "The consultation has already been accepted. Open the chat to continue the session."}
    </p>

    <div className="mt-6 flex flex-wrap gap-4">
      {isPendingConsultation ? (
        <>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={consultationActionLoading}
            className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {consultationActionLoading
              ? "Processing..."
              : "Accept"}
          </button>

          <button
            type="button"
            onClick={() => void handleReject()}
            disabled={consultationActionLoading}
            className="rounded-xl bg-red-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reject
          </button>
        </>
      ) : isActiveConsultation ? (
        <button
          type="button"
          onClick={() =>
            router.push(`/chat/${consultation.id}`)
          }
          className="rounded-xl bg-[#0B1026] px-6 py-3 font-bold text-white"
        >
          Open Chat
        </button>
      ) : (
        <p className="font-semibold text-gray-600">
          Consultation status:{" "}
          {consultationStatus || "UNKNOWN"}
        </p>
      )}
    </div>
  </section>
) : null}

        {!loading && dashboard ? (
          <>
            <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl bg-white p-6 shadow">
                <p className="text-gray-500">Total Earnings</p>

                <p className="mt-3 text-3xl font-bold text-[#0B1026]">
                  ₹{dashboard.earnings ?? 0}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow">
                <p className="text-gray-500">Today&apos;s Calls</p>

                <p className="mt-3 text-3xl font-bold text-[#0B1026]">
                  {dashboard.todayCalls ?? 0}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow">
                <p className="text-gray-500">Today&apos;s Chats</p>

                <p className="mt-3 text-3xl font-bold text-[#0B1026]">
                  {dashboard.todayChats ?? 0}
                </p>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow">
                <p className="text-gray-500">Rating</p>

                <p className="mt-3 text-3xl font-bold text-[#0B1026]">
                  {dashboard.rating ?? 0} ★
                </p>
              </article>
            </section>

            <section className="mt-8 rounded-3xl bg-white p-8 shadow">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-2xl font-bold text-[#0B1026]">
                    Profile Completion
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Complete all required details to receive consultations.
                  </p>
                </div>

                <p className="text-3xl font-bold text-amber-600">
                  {dashboard.profileCompletion ?? 0}%
                </p>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{
                    width: `${Math.min(
                      Math.max(dashboard.profileCompletion ?? 0, 0),
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Languages</p>

                  <p className="mt-1 text-gray-600">
                    {dashboard.languages?.length
                      ? dashboard.languages.join(", ")
                      : "Pending"}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Expertise</p>

                  <p className="mt-1 text-gray-600">
                    {dashboard.expertise?.length
                      ? dashboard.expertise.join(", ")
                      : "Pending"}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Pricing</p>

                  <p className="mt-1 text-gray-600">
                    ₹{dashboard.pricePerMin ?? 0}/min
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Experience</p>

                  <p className="mt-1 text-gray-600">
                    {dashboard.experience ?? 0} years
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Approval</p>

                  <p
                    className={`mt-1 font-semibold ${
                      dashboard.isApproved ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {dashboard.isApproved ? "Approved" : "Pending"}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Verification</p>

                  <p
                    className={`mt-1 font-semibold ${
                      dashboard.isVerified ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {dashboard.isVerified ? "Verified" : "Pending"}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl bg-white p-8 shadow">
                <h2 className="text-xl font-bold text-[#0B1026]">
                  Consultation Summary
                </h2>

                <p className="mt-4 text-gray-600">
                  {dashboard.pendingConsultations ?? 0} pending consultation
                  request(s).
                </p>

                <div className="mt-6 grid gap-3">
                  <Link
                    href="/consultations/current"
                    className="rounded-xl border px-5 py-4 font-bold transition hover:bg-gray-50"
                  >
                    Current Consultation
                  </Link>

                  <Link
                    href="/consultations/history"
                    className="rounded-xl border px-5 py-4 font-bold transition hover:bg-gray-50"
                  >
                    Consultation History
                  </Link>
                </div>
              </article>

              <article className="rounded-3xl bg-white p-8 shadow">
                <h2 className="text-xl font-bold text-[#0B1026]">
                  Today&apos;s Schedule
                </h2>

                <p className="mt-4 text-gray-600">
                  {dashboard.todaySchedule?.length
                    ? `${dashboard.todaySchedule.length} session(s) scheduled today.`
                    : "No scheduled sessions for today."}
                </p>

                <button
                  type="button"
                  onClick={() => void loadDashboard()}
                  className="mt-6 rounded-xl bg-[#0B1026] px-5 py-3 font-semibold text-white"
                >
                  Refresh Dashboard
                </button>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
