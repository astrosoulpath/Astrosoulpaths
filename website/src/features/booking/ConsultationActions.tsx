"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
} from "react";

import { useAppContext } from "@/app/providers";
import {
  startConsultation,
  type ConsultationMode,
} from "@/services/consultationService";
import {
  initiateCall,
  isCallSocketConnected,
} from "@/services/callSocket";

type ConsultationActionsProps = {
  /**
   * Astrologer table ka ID.
   * Backend POST /call/start mein use hota hai.
   */
  astrologerId: string;

  /**
   * Astrologer ke related User record ka ID.
   * Socket incoming call isi user ko bhejega.
   */
  astrologerUserId?: string;

  astrologerName?: string;
  isOnline: boolean;
  chatEnabled: boolean;
  audioEnabled: boolean;
  pricePerMin: number;
};

type ActiveConsultation = {
  id: string;
  userId: string;
  astrologerId: string;
  channelName: string;
  ratePerMinute: number;
  purchasedMinutes: number;
  extendedMinutes: number;
  totalMinutes: number;
  amountCharged: number;
  remainingSeconds?: number;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  status: string;
};

const durationOptions = [
  1,
  5,
  10,
  15,
  30,
];

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Unable to start consultation.";
}

export function ConsultationActions({
  astrologerId,
  astrologerUserId,
  astrologerName = "Astrologer",
  isOnline,
  chatEnabled,
  audioEnabled,
  pricePerMin,
}: ConsultationActionsProps) {
  const router = useRouter();

  const {
    userId,
    socketConnected,
  } = useAppContext();

  const [
    selectedMinutes,
    setSelectedMinutes,
  ] = useState(5);

  const [
    loadingMode,
    setLoadingMode,
  ] =
    useState<ConsultationMode | null>(
      null,
    );

  const [error, setError] =
    useState("");

  const estimatedAmount =
    useMemo(() => {
      const safePrice =
        Number.isFinite(
          pricePerMin,
        )
          ? Math.max(
              pricePerMin,
              0,
            )
          : 0;

      return (
        safePrice *
        selectedMinutes
      );
    }, [
      pricePerMin,
      selectedMinutes,
    ]);

  function getReturnPath(
    mode: ConsultationMode,
  ): string {
    return `/astrologers/${encodeURIComponent(
      astrologerId,
    )}?consultation=${mode}`;
  }

  function savePendingConsultation(
    mode: ConsultationMode,
  ): void {
    localStorage.setItem(
      "asp_pending_consultation",
      JSON.stringify({
        astrologerId,
        astrologerUserId:
          astrologerUserId ??
          null,
        astrologerName,
        mode,
        minutes:
          selectedMinutes,
        returnPath:
          getReturnPath(mode),
      }),
    );
  }

  function saveActiveConsultation(
    call: ActiveConsultation,
    mode: ConsultationMode,
  ): void {
    localStorage.setItem(
      "asp_active_call",
      JSON.stringify({
        ...call,
        mode,
        astrologerName,
        recipientUserId:
          astrologerUserId ??
          call.astrologerId,
      }),
    );
  }

  function redirectToLogin(
    mode: ConsultationMode,
  ): void {
    const returnPath =
      getReturnPath(mode);

    savePendingConsultation(
      mode,
    );

    router.push(
      `/login?redirect=${encodeURIComponent(
        returnPath,
      )}`,
    );
  }

  async function handleConsultation(
    mode: ConsultationMode,
  ): Promise<void> {
    if (loadingMode) {
      return;
    }

    setError("");

    const returnPath =
      getReturnPath(mode);

    const token =
      localStorage.getItem(
        "asp_access_token",
      );

    if (!token || !userId) {
      redirectToLogin(mode);
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
      !Number.isInteger(
        selectedMinutes,
      ) ||
      selectedMinutes < 1 ||
      selectedMinutes > 120
    ) {
      setError(
        "Please select a valid consultation duration.",
      );

      return;
    }

    /*
     * Audio socket ko Astrologer User.id chahiye.
     * Astrologer table ID aur User ID alag ho sakte hain.
     */
    if (
      mode === "audio" &&
      !astrologerUserId?.trim()
    ) {
      setError(
        "Astrologer call account is not configured. Please refresh the profile or try again later.",
      );

      return;
    }

    if (
      mode === "audio" &&
      (!socketConnected ||
        !isCallSocketConnected())
    ) {
      setError(
        "Call server is connecting. Please wait a moment and try again.",
      );

      return;
    }

    try {
      setLoadingMode(mode);

      /*
       * Backend:
       * 1. User and astrologer validate karega
       * 2. Wallet balance check karega
       * 3. Amount deduct karega
       * 4. CallSession create karega
       */
      const response =
        await startConsultation({
          astrologerId,
          minutes:
            selectedMinutes,
        });

      const call =
        response?.data
          ?.call as
          | ActiveConsultation
          | undefined;

      if (
        !call?.id ||
        !call.channelName
      ) {
        throw new Error(
          "Consultation started, but the backend did not return complete call details.",
        );
      }

      saveActiveConsultation(
        call,
        mode,
      );

      localStorage.removeItem(
        "asp_pending_consultation",
      );

      if (mode === "audio") {
        const recipientUserId =
          astrologerUserId!.trim();

        /*
         * Database session create hone ke baad
         * astrologer ko real-time incoming call bhejte hain.
         */
        const emitted =
          initiateCall({
            callId:
              call.id,

            recipientUserId,

            callerId:
              userId,

            callerName:
              "Astro Soul Path User",

            consultationType:
              "AUDIO",
          });

        if (!emitted) {
          throw new Error(
            "Consultation was created, but the incoming call could not be sent. Open My Consultations to retry.",
          );
        }

        router.push(
          `/consultations?callId=${encodeURIComponent(
            call.id,
          )}&mode=audio`,
        );

        return;
      }

      router.push(
        `/chat/${encodeURIComponent(
          call.id,
        )}`,
      );
    } catch (error: unknown) {
      const message =
        getErrorMessage(error);

      if (
        message ===
        "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        savePendingConsultation(
          mode,
        );

        router.push(
          `/login?redirect=${encodeURIComponent(
            returnPath,
          )}`,
        );

        return;
      }

      if (
        message ===
        "INSUFFICIENT_BALANCE"
      ) {
        savePendingConsultation(
          mode,
        );

        router.push(
          "/wallet/recharge",
        );

        return;
      }

      const normalizedMessage =
        message.toLowerCase();

      if (
        normalizedMessage.includes(
          "active consultation",
        )
      ) {
        setError(
          "You already have an active consultation. Open My Consultations to continue it.",
        );

        return;
      }

      if (
        normalizedMessage.includes(
          "astrologer is currently busy",
        )
      ) {
        setError(
          "This astrologer is currently busy with another consultation.",
        );

        return;
      }

      if (
        normalizedMessage.includes(
          "offline",
        )
      ) {
        setError(
          "This astrologer is currently offline.",
        );

        return;
      }

      setError(message);
    } finally {
      setLoadingMode(null);
    }
  }

  const actionsDisabled =
    loadingMode !== null;

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-start justify-between gap-4">
            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="shrink-0 font-semibold text-red-700 hover:text-red-900"
              aria-label="Close error"
            >
              ×
            </button>
          </div>
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
              value={
                selectedMinutes
              }
              disabled={
                actionsDisabled
              }
              onChange={(
                event,
              ) => {
                setSelectedMinutes(
                  Number(
                    event.target
                      .value,
                  ),
                );

                setError("");
              }}
              className="mt-2 min-w-48 rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#D4AF37] disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              {durationOptions.map(
                (minutes) => (
                  <option
                    key={
                      minutes
                    }
                    value={
                      minutes
                    }
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
              ₹
              {estimatedAmount.toFixed(
                2,
              )}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              ₹
              {Math.max(
                pricePerMin,
                0,
              ).toFixed(2)}
              /minute
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-500">
          The selected amount
          will be deducted
          securely when the
          consultation starts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={
            actionsDisabled ||
            !isOnline ||
            !chatEnabled
          }
          onClick={() =>
            void handleConsultation(
              "chat",
            )
          }
          className="rounded-xl bg-[#D4AF37] px-6 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
        >
          {loadingMode ===
          "chat"
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
            actionsDisabled ||
            !isOnline ||
            !audioEnabled
          }
          onClick={() =>
            void handleConsultation(
              "audio",
            )
          }
          className="rounded-xl bg-[#0B1026] px-6 py-4 font-semibold text-white transition hover:bg-[#171D3D] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loadingMode ===
          "audio"
            ? "Starting Audio Call..."
            : !isOnline
              ? "Audio Call Unavailable — Offline"
              : !audioEnabled
                ? "Audio Call Unavailable"
                : `Start ${selectedMinutes}-Minute Audio Call`}
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
            {isOnline
              ? "Online"
              : "Offline"}
          </strong>
        </span>

        {userId && (
          <span>
            Call server:{" "}
            <strong
              className={
                socketConnected
                  ? "text-green-700"
                  : "text-amber-600"
              }
            >
              {socketConnected
                ? "Connected"
                : "Connecting"}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}