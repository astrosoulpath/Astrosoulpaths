"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  getConsultationById,
  rateConsultation,
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

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );
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

function getAstrologerName(
  consultation: ConsultationSession,
) {
  return (
    consultation.astrologer?.userProfile?.fullName ??
    "Astrologer"
  );
}

function getCustomerName(
  consultation: ConsultationSession,
) {
  return (
    consultation.user?.userProfile?.fullName ??
    "Customer"
  );
}

function getStatusClasses(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ONGOING":
      return "border-green-200 bg-green-100 text-green-700";

    case "COMPLETED":
      return "border-blue-200 bg-blue-100 text-blue-700";

    case "CANCELLED":
      return "border-red-200 bg-red-100 text-red-700";

    case "EXPIRED":
    case "ENDED":
      return "border-gray-200 bg-gray-200 text-gray-700";

    default:
      return "border-amber-200 bg-amber-100 text-amber-700";
  }
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to process the consultation request.";
  }

  switch (error.message) {
    case "LOGIN_REQUIRED":
      return "Please log in to access this consultation.";

    case "INSUFFICIENT_BALANCE":
      return "Your wallet balance is insufficient. Please recharge before extending this consultation.";

    case "ASTROLOGER_UNAVAILABLE":
      return "The astrologer is currently unavailable.";

    case "CONSULTATION_ACCESS_DENIED":
      return "You are not allowed to access this consultation.";

    default:
      return (
        error.message ||
        "Something went wrong. Please try again."
      );
  }
}

export default function ConsultationDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const consultationId = useMemo(() => {
    const rawId = params?.id;

    return typeof rawId === "string"
      ? decodeURIComponent(rawId)
      : "";
  }, [params]);

  const [consultation, setConsultation] =
    useState<ConsultationSession | null>(null);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [selectedMinutes, setSelectedMinutes] =
    useState(5);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [isExtending, setIsExtending] =
    useState(false);
  const [isCancelling, setIsCancelling] =
    useState(false);
  const [isCompleting, setIsCompleting] =
    useState(false);
  const [isRating, setIsRating] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadConsultation = useCallback(
    async (showRefreshState = false) => {
      if (!consultationId) {
        setErrorMessage(
          "Consultation ID is missing.",
        );
        setIsLoading(false);
        return;
      }

      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const response =
          await getConsultationById(
            consultationId,
          );

        setConsultation(response.data);

        setRemainingSeconds(
          getRemainingSeconds(
            response.data.expiresAt,
          ),
        );
      } catch (error) {
        setConsultation(null);
        setErrorMessage(getErrorMessage(error));

        if (
          error instanceof Error &&
          error.message === "LOGIN_REQUIRED"
        ) {
          window.setTimeout(() => {
            router.push(
              `/login?redirect=${encodeURIComponent(
                `/consultations/${consultationId}`,
              )}`,
            );
          }, 900);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [consultationId, router],
  );

  useEffect(() => {
    void loadConsultation();
  }, [loadConsultation]);

  useEffect(() => {
    if (!consultation || consultation.endedAt) {
      return;
    }

    setRemainingSeconds(
      getRemainingSeconds(
        consultation.expiresAt,
      ),
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

  const status = consultation?.status.toUpperCase() ?? "";

  const isEnded = Boolean(
    consultation?.endedAt ||
      ["COMPLETED", "CANCELLED", "ENDED"].includes(
        status,
      ),
  );

  const isActive = Boolean(
    consultation &&
      !isEnded &&
      remainingSeconds > 0 &&
      ["ACTIVE", "ONGOING"].includes(status),
  );

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

  const canRate =
    consultation?.status.toUpperCase() ===
      "COMPLETED" &&
    Boolean(consultation.endedAt);

  const handleExtend = async () => {
    if (
      !consultation ||
      isEnded ||
      isExtending
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
      isEnded ||
      isCancelling
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel this consultation?",
    );

    if (!confirmed) {
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
      isEnded ||
      isCompleting
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to complete this consultation?",
    );

    if (!confirmed) {
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

  const handleRating = async () => {
    if (
      !consultation ||
      !canRate ||
      isRating
    ) {
      return;
    }

    try {
      setIsRating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await rateConsultation(
        consultation.id,
        {
          rating,
          comment: comment.trim() || undefined,
        },
      );

      setSuccessMessage(
        `Thank you. Your ${rating}-star rating has been submitted.`,
      );

      setComment("");

      if (
        Number.isFinite(
          response.data.astrologerRating,
        )
      ) {
        setSuccessMessage(
          `Rating submitted successfully. Astrologer rating is now ${response.data.astrologerRating}.`,
        );
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRating(false);
    }
  };

  const handleResume = () => {
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
      <main className="min-h-screen bg-[#F8F8F8] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="h-5 w-48 rounded bg-gray-200" />
            <div className="mt-4 h-10 w-96 rounded bg-gray-200" />

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

            <div className="mt-8 h-80 rounded-3xl bg-gray-100" />
          </div>
        </div>
      </main>
    );
  }

  if (!consultation) {
    return (
      <main className="min-h-[70vh] bg-[#F8F8F8] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl">
            !
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-red-600">
            Consultation
          </p>

          <h1 className="mt-3 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
            Consultation not available
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600">
            The consultation could not be loaded or
            you may not have access to it.
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
              href="/consultations/history"
              className="rounded-xl bg-[#D4AF37] px-6 py-3 font-bold text-[#0B1026]"
            >
              View History
            </Link>

            <Link
              href="/astrologers"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-[#0B1026]"
            >
              Browse Astrologers
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadConsultation(true)
              }
              disabled={isRefreshing}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-[#0B1026] disabled:opacity-60"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Retry"}
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
              Consultation Details
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026] sm:text-4xl">
              Consultation with{" "}
              {getAstrologerName(consultation)}
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600">
              Review session information, duration,
              charges, status and available actions.
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-bold ${getStatusClasses(
              consultation.status,
            )}`}
          >
            {consultation.status}
          </span>
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
          <div className="bg-[#0B1026] px-6 py-8 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-400">
                  Session Status
                </p>

                <p className="mt-3 text-4xl font-extrabold sm:text-5xl">
                  {isEnded
                    ? consultation.status
                    : formatRemainingTime(
                        remainingSeconds,
                      )}
                </p>

                <p className="mt-3 text-sm text-gray-300">
                  {isEnded
                    ? `Ended on ${formatDateTime(
                        consultation.endedAt,
                      )}`
                    : `Expires on ${formatDateTime(
                        consultation.expiresAt,
                      )}`}
                </p>
              </div>

              {isActive ? (
                <button
                  type="button"
                  onClick={handleResume}
                  className="rounded-xl bg-[#D4AF37] px-6 py-3 font-bold text-[#0B1026] transition hover:bg-[#c69f2f]"
                >
                  Resume Consultation
                </button>
              ) : null}
            </div>
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
                Total duration
              </p>

              <p className="mt-2 text-2xl font-extrabold text-[#0B1026]">
                {totalMinutes} minutes
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
                Messages
              </p>

              <p className="mt-2 text-2xl font-extrabold text-[#0B1026]">
                {consultation._count?.messages ?? 0}
              </p>
            </article>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-extrabold text-[#0B1026]">
              Session Information
            </h2>

            <dl className="mt-6 space-y-5">
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
                  Channel name
                </dt>
                <dd className="mt-1 break-all text-sm font-bold text-[#0B1026]">
                  {consultation.channelName}
                </dd>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-semibold text-gray-500">
                    Started at
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-[#0B1026]">
                    {formatDateTime(
                      consultation.startedAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-semibold text-gray-500">
                    Expires at
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-[#0B1026]">
                    {formatDateTime(
                      consultation.expiresAt,
                    )}
                  </dd>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
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
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-extrabold text-[#0B1026]">
              Participants
            </h2>

            <div className="mt-6 space-y-5">
              <article className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
                  Customer
                </p>

                <h3 className="mt-2 text-xl font-extrabold text-[#0B1026]">
                  {getCustomerName(consultation)}
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  User ID: {consultation.userId}
                </p>
              </article>

              <article className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
                  Astrologer
                </p>

                <h3 className="mt-2 text-xl font-extrabold text-[#0B1026]">
                  {getAstrologerName(
                    consultation,
                  )}
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  User ID:{" "}
                  {consultation.astrologerId}
                </p>
              </article>
            </div>
          </section>
        </div>

        {!isEnded ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                Extend Time
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Add extra minutes to the current
                consultation.
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
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                        selectedMinutes ===
                        minutes
                          ? "border-[#D4AF37] bg-amber-50 text-[#0B1026]"
                          : "border-gray-300 text-gray-700 hover:border-[#D4AF37]"
                      }`}
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

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-extrabold text-[#0B1026]">
                Consultation Actions
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Resume, complete or cancel this
                consultation.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={
                    !isActive ||
                    remainingSeconds <= 0
                  }
                  className="rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-[#0B1026] transition hover:bg-[#c69f2f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Resume Consultation
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadConsultation(true)
                  }
                  disabled={isRefreshing}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-[#0B1026] transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {isRefreshing
                    ? "Refreshing..."
                    : "Refresh Details"}
                </button>

                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="rounded-xl border border-green-300 bg-green-50 px-5 py-3 font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                >
                  {isCompleting
                    ? "Completing..."
                    : "Complete Consultation"}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="rounded-xl border border-red-300 bg-red-50 px-5 py-3 font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  {isCancelling
                    ? "Cancelling..."
                    : "Cancel Consultation"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {canRate ? (
          <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-600">
              Feedback
            </p>

            <h2 className="mt-2 text-2xl font-extrabold text-[#0B1026]">
              Rate this consultation
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Share your experience with the
              astrologer.
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700">
                Rating
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setRating(value)
                      }
                      className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-extrabold transition ${
                        rating === value
                          ? "border-[#D4AF37] bg-[#D4AF37] text-[#0B1026]"
                          : "border-gray-300 bg-white text-gray-700 hover:border-[#D4AF37]"
                      }`}
                    >
                      {value}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="mt-6">
              <label
                htmlFor="consultation-comment"
                className="text-sm font-semibold text-gray-700"
              >
                Comment
              </label>

              <textarea
                id="consultation-comment"
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                rows={5}
                maxLength={1000}
                placeholder="Write your review..."
                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-[#0B1026] outline-none transition focus:border-[#D4AF37]"
              />

              <p className="mt-2 text-right text-xs text-gray-500">
                {comment.length}/1000
              </p>
            </div>

            <button
              type="button"
              onClick={handleRating}
              disabled={isRating}
              className="mt-5 rounded-xl bg-[#0B1026] px-6 py-3 font-bold text-white transition hover:bg-[#171d39] disabled:opacity-50"
            >
              {isRating
                ? "Submitting..."
                : "Submit Rating"}
            </button>
          </section>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/consultations/history"
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center font-bold text-[#0B1026] transition hover:bg-gray-50"
          >
            Back to History
          </Link>

          <Link
            href="/consultations/current"
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center font-bold text-[#0B1026] transition hover:bg-gray-50"
          >
            Current Consultation
          </Link>

          <Link
            href="/astrologers"
            className="rounded-xl bg-[#D4AF37] px-6 py-3 text-center font-bold text-[#0B1026] transition hover:bg-[#c69f2f]"
          >
            Browse Astrologers
          </Link>
        </div>
      </div>
    </main>
  );
}