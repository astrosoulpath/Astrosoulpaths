"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  startConsultation,
  type ConsultationMode,
} from "@/services/consultationService";
import {
  initiateCall,
  isCallSocketConnected,
} from "@/services/callSocket";
import { useAppContext } from "@/app/providers";

type BookingConfirmationProps = {
  astrologerId: string;
  astrologerUserId: string;
  astrologerName: string;
  astrologerAvatarUrl?: string | null;
  mode: ConsultationMode;
  minutes: number;
  pricePerMin: number;
  returnPath?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to start consultation.";
  }

  switch (error.message) {
    case "LOGIN_REQUIRED":
      return "Please log in before starting the consultation.";

    case "INSUFFICIENT_BALANCE":
      return "Your wallet balance is insufficient. Please recharge and try again.";

    case "ACTIVE_CONSULTATION_EXISTS":
      return "You already have an active consultation.";

    case "ASTROLOGER_BUSY":
      return "This astrologer is currently busy with another consultation.";

    case "ASTROLOGER_UNAVAILABLE":
      return "This astrologer is currently offline or unavailable.";

    default:
      return error.message || "Unable to start consultation.";
  }
}

export function BookingConfirmation({
  astrologerId,
  astrologerUserId,
  astrologerName,
  astrologerAvatarUrl,
  mode,
  minutes,
  pricePerMin,
  returnPath,
}: BookingConfirmationProps) {
  const router = useRouter();

  const { userId, socketConnected } = useAppContext();

  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  const totalAmount = useMemo(() => {
    const safePrice = Number.isFinite(pricePerMin)
      ? Math.max(pricePerMin, 0)
      : 0;

    const safeMinutes = Number.isInteger(minutes)
      ? Math.max(minutes, 0)
      : 0;

    return safePrice * safeMinutes;
  }, [minutes, pricePerMin]);

  const normalizedReturnPath =
    returnPath ||
    `/astrologers/${encodeURIComponent(astrologerId)}`;

  function savePendingConsultation() {
    window.localStorage.setItem(
      "asp_pending_consultation",
      JSON.stringify({
        astrologerId,
        astrologerUserId,
        astrologerName,
        astrologerAvatarUrl: astrologerAvatarUrl ?? null,
        mode,
        minutes,
        purchasedMinutes: minutes,
        pricePerMin,
        returnPath: normalizedReturnPath,
      }),
    );
  }

  function handleBack() {
    router.push(normalizedReturnPath);
  }

  async function handleConfirm() {
    if (isStarting) {
      return;
    }

    setErrorMessage(null);

    const token = window.localStorage.getItem(
      "asp_access_token",
    );

    if (!token || !userId) {
      savePendingConsultation();

      router.push(
        `/login?redirect=${encodeURIComponent(
          `/consultations/confirm?astrologerId=${encodeURIComponent(
            astrologerId,
          )}&astrologerUserId=${encodeURIComponent(
            astrologerUserId,
          )}&mode=${encodeURIComponent(
            mode,
          )}&minutes=${minutes}&pricePerMin=${pricePerMin}&astrologerName=${encodeURIComponent(
            astrologerName,
          )}`,
        )}`,
      );

      return;
    }

    if (!astrologerUserId.trim()) {
      setErrorMessage(
        "Astrologer account is not configured correctly.",
      );
      return;
    }

    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 180
    ) {
      setErrorMessage(
        "Consultation duration must be between 1 and 180 minutes.",
      );
      return;
    }

    if (
      mode === "audio" &&
      (!socketConnected || !isCallSocketConnected())
    ) {
      setErrorMessage(
        "Call server is still connecting. Please wait and try again.",
      );
      return;
    }

    try {
      setIsStarting(true);

      const response = await startConsultation({
        astrologerUserId: astrologerUserId.trim(),
        purchasedMinutes: minutes,
        mode,
      });

      const call = response.data.call;

      if (!call?.id || !call.channelName) {
        throw new Error(
          "Consultation started, but complete call details were not returned.",
        );
      }

      const expiryTime = new Date(call.expiresAt).getTime();

      const remainingSeconds = Number.isNaN(expiryTime)
        ? undefined
        : Math.max(
            Math.floor((expiryTime - Date.now()) / 1000),
            0,
          );

      window.localStorage.setItem(
        "asp_active_call",
        JSON.stringify({
          ...call,
          mode,
          astrologerName,
          astrologerAvatarUrl: astrologerAvatarUrl ?? null,
          totalMinutes:
            call.purchasedMinutes + call.extendedMinutes,
          remainingSeconds,
          recipientUserId: astrologerUserId,
        }),
      );

      window.localStorage.removeItem(
        "asp_pending_consultation",
      );

      if (mode === "audio") {
        const emitted = initiateCall({
          callId: call.id,
          recipientUserId: astrologerUserId,
          callerId: userId,
          callerName: "Astro Soul Path User",
          consultationType: "AUDIO",
        });

        if (!emitted) {
          router.push("/consultations/current");
          return;
        }

        router.push(
          `/audio-call?callId=${encodeURIComponent(
            call.id,
          )}&channelName=${encodeURIComponent(
            call.channelName,
          )}`,
        );

        return;
      }

      router.push(`/chat/${encodeURIComponent(call.id)}`);
    } catch (error) {
      const message = getErrorMessage(error);

      if (
        error instanceof Error &&
        error.message === "LOGIN_REQUIRED"
      ) {
        window.localStorage.removeItem(
          "asp_access_token",
        );

        savePendingConsultation();

        router.push(
          `/login?redirect=${encodeURIComponent(
            window.location.pathname +
              window.location.search,
          )}`,
        );

        return;
      }

      if (
        error instanceof Error &&
        error.message === "INSUFFICIENT_BALANCE"
      ) {
        savePendingConsultation();

        router.push(
          `/wallet/recharge?redirect=${encodeURIComponent(
            window.location.pathname +
              window.location.search,
          )}`,
        );

        return;
      }

      setErrorMessage(message);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-2xl font-extrabold text-[#0B1026]">
            {astrologerAvatarUrl ? (
               
              <img
                src={astrologerAvatarUrl}
                alt={astrologerName}
                className="h-full w-full object-cover"
              />
            ) : (
              astrologerName.charAt(0).toUpperCase()
            )}
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-600">
              Booking Confirmation
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026]">
              Confirm your consultation
            </h1>

            <p className="mt-2 text-base text-gray-600">
              Review the details before starting your session with{" "}
              <strong className="text-[#0B1026]">
                {astrologerName}
              </strong>
              .
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Unable to start consultation
            </p>

            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200">
          <div className="grid gap-px bg-gray-200 sm:grid-cols-2">
            <article className="bg-white p-5">
              <p className="text-sm font-semibold text-gray-500">
                Astrologer
              </p>

              <p className="mt-2 text-lg font-extrabold text-[#0B1026]">
                {astrologerName}
              </p>
            </article>

            <article className="bg-white p-5">
              <p className="text-sm font-semibold text-gray-500">
                Consultation mode
              </p>

              <p className="mt-2 text-lg font-extrabold capitalize text-[#0B1026]">
                {mode === "audio" ? "Audio Call" : "Chat"}
              </p>
            </article>

            <article className="bg-white p-5">
              <p className="text-sm font-semibold text-gray-500">
                Duration
              </p>

              <p className="mt-2 text-lg font-extrabold text-[#0B1026]">
                {minutes}{" "}
                {minutes === 1 ? "minute" : "minutes"}
              </p>
            </article>

            <article className="bg-white p-5">
              <p className="text-sm font-semibold text-gray-500">
                Rate per minute
              </p>

              <p className="mt-2 text-lg font-extrabold text-[#0B1026]">
                {formatCurrency(pricePerMin)}
              </p>
            </article>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#0B1026] p-6 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-300">
                Total payable
              </p>

              <p className="mt-2 text-3xl font-extrabold text-amber-400">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-300">
                Payment method
              </p>

              <p className="mt-2 font-bold">
                Astro Soul Path Wallet
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">
            Wallet deduction notice
          </p>

          <p className="mt-1 text-sm leading-6 text-amber-700">
            The full consultation amount will be deducted from your
            wallet when you confirm. The consultation and wallet
            transaction are created together securely.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={isStarting}
            className="rounded-xl border border-gray-300 bg-white px-6 py-4 font-bold text-[#0B1026] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>

          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isStarting}
            className="rounded-xl bg-[#D4AF37] px-6 py-4 font-bold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting
              ? "Starting Consultation..."
              : `Confirm & Pay ${formatCurrency(totalAmount)}`}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="/consultations/current"
            className="font-semibold text-[#0B1026] underline-offset-4 hover:underline"
          >
            Current Consultation
          </Link>

          <Link
            href="/consultations/history"
            className="font-semibold text-[#0B1026] underline-offset-4 hover:underline"
          >
            Consultation History
          </Link>

          <Link
            href="/wallet"
            className="font-semibold text-[#0B1026] underline-offset-4 hover:underline"
          >
            View Wallet
          </Link>
        </div>
      </div>
    </section>
  );
}