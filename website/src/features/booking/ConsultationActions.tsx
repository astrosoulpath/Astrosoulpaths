"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  startConsultation,
  type ConsultationMode,
} from "@/services/consultationService";

type ConsultationActionsProps = {
  astrologerId: string;
  isOnline: boolean;
  chatEnabled: boolean;
  audioEnabled: boolean;
  pricePerMin: number;
};

const durationOptions = [1, 5, 10, 15, 30];

export function ConsultationActions({
  astrologerId,
  isOnline,
  chatEnabled,
  audioEnabled,
  pricePerMin,
}: ConsultationActionsProps) {
  const router = useRouter();

  const [selectedMinutes, setSelectedMinutes] =
    useState(5);

  const [loadingMode, setLoadingMode] =
    useState<ConsultationMode | null>(null);

  const [error, setError] = useState("");

  const estimatedAmount = useMemo(() => {
    const safePrice = Number.isFinite(pricePerMin)
      ? Math.max(pricePerMin, 0)
      : 0;

    return safePrice * selectedMinutes;
  }, [pricePerMin, selectedMinutes]);

  function getReturnPath(mode: ConsultationMode) {
    return `/astrologers/${encodeURIComponent(
      astrologerId,
    )}?consultation=${mode}`;
  }

  function savePendingConsultation(
    mode: ConsultationMode,
  ) {
    localStorage.setItem(
      "asp_pending_consultation",
      JSON.stringify({
        astrologerId,
        mode,
        minutes: selectedMinutes,
        returnPath: getReturnPath(mode),
      }),
    );
  }

  async function handleConsultation(
    mode: ConsultationMode,
  ) {
    setError("");

    const returnPath = getReturnPath(mode);

    const token = localStorage.getItem(
      "asp_access_token",
    );

    if (!token) {
      savePendingConsultation(mode);

      router.push(
        `/login?redirect=${encodeURIComponent(
          returnPath,
        )}`,
      );

      return;
    }

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
      selectedMinutes > 120
    ) {
      setError(
        "Please select a valid consultation duration.",
      );

      return;
    }

    /*
     * Backend CallSession currently does not store a
     * consultation mode. Until audio provider integration is
     * complete, only chat is started through the real backend.
     */
    if (mode === "audio") {
      setError(
        "Real audio calling is not connected yet. Please start a chat consultation.",
      );

      return;
    }

    try {
      setLoadingMode(mode);

      const response = await startConsultation({
        astrologerId,
        minutes: selectedMinutes,
      });

      const call = response?.data?.call;

      if (!call?.id) {
        throw new Error(
          "Consultation started, but the backend did not return a consultation ID.",
        );
      }

      localStorage.removeItem(
        "asp_pending_consultation",
      );

      /*
       * Temporary compatibility data for the current chat page.
       * The next step will update the chat page to read the real
       * consultation directly from GET /call/current.
       */
      localStorage.setItem(
        "asp_active_call",
        JSON.stringify(call),
      );

      router.push(
        `/chat/${encodeURIComponent(call.id)}`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to start consultation.";

      if (message === "LOGIN_REQUIRED") {
        savePendingConsultation(mode);

        localStorage.removeItem(
          "asp_access_token",
        );

        router.push(
          `/login?redirect=${encodeURIComponent(
            returnPath,
          )}`,
        );

        return;
      }

      if (
        message === "INSUFFICIENT_BALANCE"
      ) {
        savePendingConsultation(mode);

        router.push("/wallet/recharge");

        return;
      }

      if (
        message
          .toLowerCase()
          .includes("active consultation")
      ) {
        setError(
          "You already have an active consultation. Open My Consultations to continue it.",
        );

        return;
      }

      setError(message);
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

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
              disabled={loadingMode !== null}
              onChange={(event) => {
                setSelectedMinutes(
                  Number(event.target.value),
                );
                setError("");
              }}
              className="mt-2 min-w-48 rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#D4AF37] disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              {durationOptions.map(
                (minutes) => (
                  <option
                    key={minutes}
                    value={minutes}
                  >
                    {minutes}{" "}
                    {minutes === 1
                      ? "minute"
                      : "minutes"}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="rounded-xl bg-white px-5 py-3 text-right">
            <p className="text-xs text-gray-500">
              Payable upfront
            </p>

            <p className="mt-1 text-xl font-bold text-[#D4AF37]">
              ₹{estimatedAmount.toFixed(2)}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              ₹{pricePerMin}/minute
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-500">
          The selected duration amount will be deducted securely
          by the backend when the consultation starts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={
            loadingMode !== null ||
            !isOnline ||
            !chatEnabled
          }
          onClick={() =>
            void handleConsultation("chat")
          }
          className="rounded-xl bg-[#D4AF37] px-6 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
        >
          {loadingMode === "chat"
            ? "Starting Chat..."
            : !isOnline
              ? "Chat Unavailable — Offline"
              : !chatEnabled
                ? "Chat Unavailable"
                : `Start ${selectedMinutes}-Minute Chat`}
        </button>

        <button
          type="button"
          disabled={
            loadingMode !== null ||
            !isOnline ||
            !audioEnabled
          }
          onClick={() =>
            void handleConsultation("audio")
          }
          className="rounded-xl bg-[#0B1026] px-6 py-4 font-semibold text-white transition hover:bg-[#171D3D] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loadingMode === "audio"
            ? "Starting Audio Call..."
            : !isOnline
              ? "Audio Call Unavailable — Offline"
              : !audioEnabled
                ? "Audio Call Unavailable"
                : "Start Audio Call"}
        </button>
      </div>
    </div>
  );
}