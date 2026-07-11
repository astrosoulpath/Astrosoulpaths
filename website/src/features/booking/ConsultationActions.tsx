"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ConsultationMode } from "@/services/bookingService";

type ConsultationActionsProps = {
  astrologerId: string;
  isOnline: boolean;
  chatEnabled: boolean;
  audioEnabled: boolean;
  pricePerMin: number;
};

type LocalBooking = {
  id: string;
  astrologerId: string;
  astrologerName?: string;
  mode: ConsultationMode;
  pricePerMin: number;
  status: "active" | "completed";
  createdAt: string;
};

function createBookingId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function ConsultationActions({
  astrologerId,
  isOnline,
  chatEnabled,
  audioEnabled,
  pricePerMin,
}: ConsultationActionsProps) {
  const router = useRouter();

  const [loadingMode, setLoadingMode] =
    useState<ConsultationMode | null>(null);

  const [error, setError] = useState("");

  function getRedirectPath(mode: ConsultationMode) {
    return `/astrologers/${encodeURIComponent(
      astrologerId,
    )}?consultation=${mode}`;
  }

  function getWalletBalance(): number {
    const storedBalance = Number(
      localStorage.getItem("asp_wallet_balance") ?? "0",
    );

    return Number.isFinite(storedBalance)
      ? storedBalance
      : 0;
  }

  function readBookings(): LocalBooking[] {
    const storedBookings = localStorage.getItem(
      "asp_consultation_bookings",
    );

    if (!storedBookings) {
      return [];
    }

    try {
      const parsed = JSON.parse(
        storedBookings,
      ) as LocalBooking[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function handleConsultation(
    mode: ConsultationMode,
  ) {
    setError("");

    const token = localStorage.getItem(
      "asp_access_token",
    );

    const returnPath = getRedirectPath(mode);

    if (!token) {
      router.push(
        `/login?redirect=${encodeURIComponent(returnPath)}`,
      );
      return;
    }

    if (!isOnline) {
      setError("This astrologer is currently offline.");
      return;
    }

    const modeEnabled =
      mode === "chat" ? chatEnabled : audioEnabled;

    if (!modeEnabled) {
      setError(
        mode === "chat"
          ? "Chat consultation is currently unavailable."
          : "Audio-call consultation is currently unavailable.",
      );
      return;
    }

    const walletBalance = getWalletBalance();
    const minimumRequiredBalance = Math.max(pricePerMin, 1);

    if (walletBalance < minimumRequiredBalance) {
      localStorage.setItem(
        "asp_pending_consultation",
        JSON.stringify({
          astrologerId,
          mode,
          returnPath,
        }),
      );

      router.push("/wallet/recharge");
      return;
    }

    try {
      setLoadingMode(mode);

      const bookingId = createBookingId();

      const booking: LocalBooking = {
        id: bookingId,
        astrologerId,
        mode,
        pricePerMin,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const existingBookings = readBookings();

      localStorage.setItem(
        "asp_consultation_bookings",
        JSON.stringify([
          booking,
          ...existingBookings,
        ]),
      );

      localStorage.removeItem(
        "asp_pending_consultation",
      );

      if (mode === "chat") {
        router.push(
          `/chat/${encodeURIComponent(bookingId)}`,
        );
        return;
      }

      setError(
        "Audio-call screen will be connected in the next phase.",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start consultation.",
      );
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

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
                : "Start Chat Consultation"}
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