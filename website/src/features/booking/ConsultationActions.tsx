"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ConsultationMode } from "@/services/consultationService";

type ConsultationActionsProps = {
  /**
   * Astrologer table record ID.
   * Used for profile URL and return navigation.
   */
  astrologerId: string;

  /**
   * Astrologer's linked User.id.
   * Required by the consultation backend.
   */
  astrologerUserId?: string;

  astrologerName?: string;
  astrologerAvatarUrl?: string | null;

  isOnline: boolean;
  chatEnabled: boolean;
  audioEnabled: boolean;
  pricePerMin: number;
};

const durationOptions = [1, 5, 10, 15, 30];

function getSafePrice(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(value, 0);
}

export function ConsultationActions({
  astrologerId,
  astrologerUserId,
  astrologerName = "Astrologer",
  astrologerAvatarUrl = null,
  isOnline,
  chatEnabled,
  audioEnabled,
  pricePerMin,
}: ConsultationActionsProps) {
  const router = useRouter();

  const [selectedMinutes, setSelectedMinutes] =
    useState(5);

  const [error, setError] = useState("");

  const safePricePerMin = useMemo(
    () => getSafePrice(pricePerMin),
    [pricePerMin],
  );

  const estimatedAmount = useMemo(
    () => safePricePerMin * selectedMinutes,
    [safePricePerMin, selectedMinutes],
  );

  function getProfilePath() {
    return `/astrologers/${encodeURIComponent(
      astrologerId,
    )}`;
  }

  function savePendingConsultation(
    mode: ConsultationMode,
  ) {
    window.localStorage.setItem(
      "asp_pending_consultation",
      JSON.stringify({
        astrologerId,
        astrologerUserId:
          astrologerUserId?.trim() || null,
        astrologerName,
        astrologerAvatarUrl,
        mode,
        minutes: selectedMinutes,
        purchasedMinutes: selectedMinutes,
        pricePerMin: safePricePerMin,
        returnPath: getProfilePath(),
      }),
    );
  }

  function openConfirmationPage(
    mode: ConsultationMode,
  ) {
    setError("");

    if (!isOnline) {
      setError(
        "This astrologer is currently offline.",
      );
      return;
    }

    const modeEnabled =
      mode === "chat"
        ? chatEnabled
        : audioEnabled;

    if (!modeEnabled) {
      setError(
        mode === "chat"
          ? "Chat consultation is currently unavailable."
          : "Audio-call consultation is currently unavailable.",
      );
      return;
    }

    if (
      !Number.isInteger(selectedMinutes) ||
      selectedMinutes < 1 ||
      selectedMinutes > 180
    ) {
      setError(
        "Please select a valid consultation duration.",
      );
      return;
    }

    const normalizedAstrologerUserId =
      astrologerUserId?.trim();

    if (!normalizedAstrologerUserId) {
      setError(
        "Astrologer account is not configured correctly. Please refresh the profile or try again later.",
      );
      return;
    }

    if (safePricePerMin <= 0) {
      setError(
        "The astrologer consultation price is not configured.",
      );
      return;
    }

    savePendingConsultation(mode);

    const query = new URLSearchParams({
      astrologerId,
      astrologerUserId:
        normalizedAstrologerUserId,
      astrologerName,
      mode,
      minutes: String(selectedMinutes),
      pricePerMin: String(safePricePerMin),
      returnPath: getProfilePath(),
    });

    if (astrologerAvatarUrl) {
      query.set(
        "astrologerAvatarUrl",
        astrologerAvatarUrl,
      );
    }

    router.push(
      `/consultations/confirm?${query.toString()}`,
    );
  }

  return (
    <div>
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-start justify-between gap-4">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 font-semibold text-red-700 transition hover:text-red-900"
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl bg-[#FAF7F0] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label
              htmlFor="consultation-duration"
              className="block text-sm font-semibold text-[#0B1026]"
            >
              Consultation duration
            </label>

            <select
              id="consultation-duration"
              value={selectedMinutes}
              onChange={(event) => {
                setSelectedMinutes(
                  Number(event.target.value),
                );
                setError("");
              }}
              className="mt-2 min-w-48 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#0B1026] outline-none transition focus:border-[#D4AF37]"
            >
              {durationOptions.map((minutes) => (
                <option
                  key={minutes}
                  value={minutes}
                >
                  {minutes}{" "}
                  {minutes === 1
                    ? "minute"
                    : "minutes"}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-white px-5 py-3 text-right">
            <p className="text-xs text-gray-500">
              Estimated total
            </p>

            <p className="mt-1 text-xl font-bold text-[#D4AF37]">
              ₹{estimatedAmount.toFixed(2)}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              ₹{safePricePerMin.toFixed(2)}
              /minute
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-500">
          You will review and confirm the booking before
          any amount is deducted from your wallet.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={!isOnline || !chatEnabled}
          onClick={() =>
            openConfirmationPage("chat")
          }
          className="rounded-xl bg-[#D4AF37] px-6 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
        >
          {!isOnline
            ? "Chat Unavailable — Offline"
            : !chatEnabled
              ? "Chat Unavailable"
              : `Continue with ${selectedMinutes}-Minute Chat`}
        </button>

        <button
          type="button"
          disabled={!isOnline || !audioEnabled}
          onClick={() =>
            openConfirmationPage("audio")
          }
          className="rounded-xl bg-[#0B1026] px-6 py-4 font-semibold text-white transition hover:bg-[#171D3D] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {!isOnline
            ? "Audio Call Unavailable — Offline"
            : !audioEnabled
              ? "Audio Call Unavailable"
              : `Continue with ${selectedMinutes}-Minute Audio Call`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Astrologer status:{" "}
          <strong
            className={
              isOnline
                ? "text-green-700"
                : "text-red-600"
            }
          >
            {isOnline ? "Online" : "Offline"}
          </strong>
        </span>

        <span>
          Payment:{" "}
          <strong className="text-[#0B1026]">
            Wallet after confirmation
          </strong>
        </span>
      </div>
    </div>
  );
}