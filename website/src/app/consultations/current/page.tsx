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
  cancelConsultation,
  completeConsultation,
  extendConsultation,
  getCurrentConsultation,
  type ConsultationSession,
} from "@/services/consultationService";

const EXTENSION_OPTIONS = [5, 10, 15, 30];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(
      minutes,
    ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function getRemainingSeconds(expiresAt: string) {
  const expiryTime = new Date(expiresAt).getTime();

  if (Number.isNaN(expiryTime)) {
    return 0;
  }

  return Math.max(
    Math.floor((expiryTime - Date.now()) / 1000),
    0,
  );
}

function getAstrologerName(
  consultation: ConsultationSession,
) {
  return (
    consultation.astrologer?.userProfile?.fullName ??
    "Astrologer"
  );
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to process the consultation request.";
  }

  switch (error.message) {
    case "LOGIN_REQUIRED":
      return "Please log in to access your consultation.";

    case "INSUFFICIENT_BALANCE":
      return "Your wallet balance is insufficient. Please recharge before extending the consultation.";

    case "ACTIVE_CONSULTATION_EXISTS":
      return "An active consultation already exists.";

    case "ASTROLOGER_UNAVAILABLE":
      return "The astrologer is currently unavailable.";

    default:
      return (
        error.message ||
        "Something went wrong. Please try again."
      );
  }
}

export default function CurrentConsultationPage() {
  const router = useRouter();

  const [consultation, setConsultation] =
    useState<ConsultationSession | null>(null);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [selectedMinutes, setSelectedMinutes] =
    useState(5);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [isExtending, setIsExtending] =
    useState(false);
  const [isCancelling, setIsCancelling] =
    useState(false);
  const [isCompleting, setIsCompleting] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadCurrentConsultation = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const response =
          await getCurrentConsultation();

        const currentConsultation =
          response.data ?? null;

        setConsultation(currentConsultation);

        if (currentConsultation) {
          setRemainingSeconds(
            getRemainingSeconds(
              currentConsultation.expiresAt,
            ),
          );
        } else {
          setRemainingSeconds(0);
        }
      } catch (error) {
        const message = getErrorMessage(error);

        setConsultation(null);
        setErrorMessage(message);

        if (
          error instanceof Error &&
          error.message === "LOGIN_REQUIRED"
        ) {
          window.setTimeout(() => {
            router.push(
              `/login?redirect=${encodeURIComponent(
                "/consultations/current",
              )}`,
            );
          }, 900);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadCurrentConsultation();
  }, [loadCurrentConsultation]);

  useEffect(() => {
    if (!consultation || consultation.endedAt) {
      return;
    }

    setRemainingSeconds(
      getRemainingSeconds(consultation.expiresAt),
    );

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((currentValue) => {
        if (currentValue <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [consultation]);

  const totalMinutes = useMemo(() => {
    if (!consultation) {
      return 0;
    }

    return (
      consultation.purchasedMinutes +
      consultation.extendedMinutes
    );
  }, [consultation]);

  const extensionAmount = useMemo(() => {
    if (!consultation) {
      return 0;
    }

    return (
      consultation.ratePerMinute *
      selectedMinutes
    );
  }, [consultation, selectedMinutes]);

  const isEnded = Boolean(
    consultation?.endedAt ||
      consultation?.status.toUpperCase() ===
        "COMPLETED" ||
      consultation?.status.toUpperCase() ===
        "CANCELLED",
  );

  const handleExtend = async () => {
    if (
      !consultation ||
      isExtending ||
      isEnded
    ) {
      return;
    }

    try {
      setIsExtending(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await extendConsultation(
        consultation.id,
        selectedMinutes,
      );

      setConsultation(response.data);

      setRemainingSeconds(
        getRemainingSeconds(
          response.data.expiresAt,
        ),
      );

      setSuccessMessage(
        `Consultation extended by ${selectedMinutes} minutes.`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsExtending(false);
    }
  };

  const handleCancel = async () => {
    if (
      !consultation ||
      isCancelling ||
      isEnded
    ) {
      return;
    }

    const shouldCancel = window.confirm(
      "Are you sure you want to cancel this consultation?",
    );

    if (!shouldCancel) {
      return;
    }

    try {
      setIsCancelling(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await cancelConsultation(
        consultation.id,
      );

      setConsultation(response.data);
      setRemainingSeconds(0);

      setSuccessMessage(
        "Consultation cancelled successfully.",
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (
      !consultation ||
      isCompleting ||
      isEnded
    ) {
      return;
    }

    const shouldComplete = window.confirm(
      "Are you sure you want to complete this consultation?",
    );

    if (!shouldComplete) {
      return;
    }

    try {
      setIsCompleting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response =
        await completeConsultation(
          consultation.id,
        );

      setConsultation(response.data);
      setRemainingSeconds(0);

      setSuccessMessage(
        "Consultation completed successfully.",
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCompleting(false);
    }
  };

  const handleOpenSession = () => {
    if (!consultation) {
      return;
    }

    router.push(
      `/audio-call?callId=${encodeURIComponent(
        consultation.id,
      )}&channelName=${encodeURIComponent(
        consultation.channelName,
      )}`,
    );
  };

  if (isLoading) {
    return (
      <main className="min-h-[70vh] bg-[#F8F8F8] px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="h-5 w-40 rounded bg-gray-200" />

            <div className="mt-4 h-10 w-72 rounded bg-gray-200" />

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-28 rounded-2xl bg-gray-100"
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!consultation) {
    return (
      <main className="min-h-[70vh] bg-[#F8F8F8] px-5 py-16">
        <section className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">
            ✦
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
            Consultation
          </p>

          <h1 className="mt-3 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
            No active consultation
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600">
            Select an available astrologer and
            start a new chat or audio
            consultation.
          </p>

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-left">
              <p className="font-semibold text-red-700">
                Unable to load consultation
              </p>

              <p className="mt-1 text-sm text-red-600">
                {errorMessage}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/astrologers"
              className="rounded-xl bg-[#D4AF37] px-6 py-3 font-bold text-[#0B1026] transition hover:bg-[#c69f2f]"
            >
              Browse Astrologers
            </Link>

            <Link
              href="/consultations/history"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50"
            >
              View History
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadCurrentConsultation(
                  true,
                )
              }
              disabled={isRefreshing}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              Active Consultation
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Consultation with{" "}
              {getAstrologerName(
                consultation,
              )}
            </h1>

            <p className="mt-3 text-base text-gray-600">
              Manage your active session,
              remaining time and consultation
              actions.
            </p>
          </div>

          <div
            className={`inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-bold ${
              isEnded
                ? "bg-gray-200 text-gray-700"
                : remainingSeconds > 0
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {isEnded
              ? consultation.status
              : remainingSeconds > 0
                ? "Active"
                : "Time expired"}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Request failed
            </p>

            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-700">
              {successMessage}
            </p>
          </div>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-[#0B1026] px-6 py-8 text-white sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-400">
              Time Remaining
            </p>

            <p className="mt-3 text-5xl font-extrabold tabular-nums sm:text-6xl">
              {formatRemainingTime(
                remainingSeconds,
              )}
            </p>

            <p className="mt-3 text-sm text-gray-300">
              Session expires on{" "}
              {formatDateTime(
                consultation.expiresAt,
              )}
            </p>
          </div>

          <div className="grid gap-px bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
            <article className="bg-white p-6">
              <p className="text-sm font-semibold text-gray-500">
                Rate per minute
              </p>

              <p className="mt-2 text-2xl font-extrabold text-[#0B1026]">
                {formatCurrency(
                  consultation.ratePerMinute,
                )}
              </p>
            </article>

            <article className="bg-white p-6">
              <p className="text-sm font-semibold text-gray-500">
                Total minutes
              </p>

              <p className="mt-2 text-2xl font-extrabold text-[#0B1026]">
                {totalMinutes}
              </p>
            </article>

            <article className="bg-white p-6">
              <p className="text-sm font-semibold text-gray-500">
                Amount charged
              </p>

              <p className="mt-2 text-2xl font-extrabold text-[#0B1026]">
                {formatCurrency(
                  consultation.amountCharged,
                )}
              </p>
            </article>

            <article className="bg-white p-6">
              <p className="text-sm font-semibold text-gray-500">
                Started at
              </p>

              <p className="mt-2 text-base font-bold text-[#0B1026]">
                {formatDateTime(
                  consultation.startedAt,
                )}
              </p>
            </article>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-extrabold text-[#0B1026]">
              Session Actions
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Resume the consultation or
              complete and cancel the current
              session.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleOpenSession}
                disabled={
                  isEnded ||
                  remainingSeconds <= 0
                }
                className="rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-[#0B1026] transition hover:bg-[#c69f2f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Resume Consultation
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadCurrentConsultation(
                    true,
                  )
                }
                disabled={isRefreshing}
                className="rounded-xl border border-gray-300 px-5 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRefreshing
                  ? "Refreshing..."
                  : "Refresh Details"}
              </button>

              <button
                type="button"
                onClick={handleComplete}
                disabled={
                  isEnded || isCompleting
                }
                className="rounded-xl border border-green-300 bg-green-50 px-5 py-3 font-bold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCompleting
                  ? "Completing..."
                  : "Complete Consultation"}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={
                  isEnded || isCancelling
                }
                className="rounded-xl border border-red-300 bg-red-50 px-5 py-3 font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling
                  ? "Cancelling..."
                  : "Cancel Consultation"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-extrabold text-[#0B1026]">
              Extend Time
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Add extra minutes before the current
              consultation expires.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {EXTENSION_OPTIONS.map(
                (minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() =>
                      setSelectedMinutes(
                        minutes,
                      )
                    }
                    disabled={isEnded}
                    className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      selectedMinutes ===
                      minutes
                        ? "border-[#D4AF37] bg-amber-50 text-[#0B1026]"
                        : "border-gray-300 text-gray-700 hover:border-[#D4AF37]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    +{minutes} min
                  </button>
                ),
              )}
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-600">
                  Additional charge
                </span>

                <strong className="text-lg text-[#0B1026]">
                  {formatCurrency(
                    extensionAmount,
                  )}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExtend}
              disabled={
                isEnded ||
                isExtending ||
                remainingSeconds <= 0
              }
              className="mt-5 w-full rounded-xl bg-[#0B1026] px-5 py-3 font-bold text-white transition hover:bg-[#171d39] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExtending
                ? "Extending..."
                : `Extend by ${selectedMinutes} Minutes`}
            </button>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-extrabold text-[#0B1026]">
            Consultation Details
          </h2>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-semibold text-gray-500">
                Consultation ID
              </dt>

              <dd className="mt-1 break-all text-sm font-bold text-[#0B1026]">
                {consultation.id}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-semibold text-gray-500">
                Channel
              </dt>

              <dd className="mt-1 break-all text-sm font-bold text-[#0B1026]">
                {consultation.channelName}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-semibold text-gray-500">
                Status
              </dt>

              <dd className="mt-1 text-sm font-bold text-[#0B1026]">
                {consultation.status}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-semibold text-gray-500">
                Purchased minutes
              </dt>

              <dd className="mt-1 text-sm font-bold text-[#0B1026]">
                {
                  consultation.purchasedMinutes
                }
              </dd>
            </div>

            <div>
              <dt className="text-sm font-semibold text-gray-500">
                Extended minutes
              </dt>

              <dd className="mt-1 text-sm font-bold text-[#0B1026]">
                {
                  consultation.extendedMinutes
                }
              </dd>
            </div>

            <div>
              <dt className="text-sm font-semibold text-gray-500">
                Ended at
              </dt>

              <dd className="mt-1 text-sm font-bold text-[#0B1026]">
                {formatDateTime(
                  consultation.endedAt,
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}