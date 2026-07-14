"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ConsultationType =
  | "AUDIO"
  | "VIDEO";

type IncomingCallModalProps = {
  open: boolean;
  callerName: string;
  consultationType?: ConsultationType;
  timeoutSeconds?: number;
  isProcessing?: boolean;
  onAccept: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
};

export default function IncomingCallModal({
  open,
  callerName,
  consultationType = "AUDIO",
  timeoutSeconds = 30,
  isProcessing = false,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const safeTimeoutSeconds =
    Number.isFinite(timeoutSeconds) &&
    timeoutSeconds > 0
      ? Math.floor(timeoutSeconds)
      : 30;

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(safeTimeoutSeconds);

  const [
    action,
    setAction,
  ] = useState<
    "ACCEPT" | "REJECT" | null
  >(null);

  useEffect(() => {
    if (!open) {
      setRemainingSeconds(
        safeTimeoutSeconds,
      );

      setAction(null);

      return;
    }

    setRemainingSeconds(
      safeTimeoutSeconds,
    );

    const intervalId =
      window.setInterval(() => {
        setRemainingSeconds(
          (currentSeconds) =>
            Math.max(
              0,
              currentSeconds - 1,
            ),
        );
      }, 1_000);

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, [
    open,
    safeTimeoutSeconds,
  ]);

  useEffect(() => {
    if (
      !open ||
      remainingSeconds > 0 ||
      action
    ) {
      return;
    }

    setAction("REJECT");

    void Promise.resolve(
      onReject(),
    ).finally(() => {
      setAction(null);
    });
  }, [
    action,
    onReject,
    open,
    remainingSeconds,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        !isProcessing &&
        !action
      ) {
        event.preventDefault();

        setAction("REJECT");

        void Promise.resolve(
          onReject(),
        ).finally(() => {
          setAction(null);
        });
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    action,
    isProcessing,
    onReject,
    open,
  ]);

  const normalizedCallerName =
    callerName?.trim() ||
    "Astro Soul Path User";

  const callLabel =
    consultationType === "VIDEO"
      ? "Video consultation"
      : "Audio consultation";

  const callIcon =
    consultationType === "VIDEO"
      ? "🎥"
      : "📞";

  const isBusy =
    isProcessing ||
    action !== null;

  const countdownLabel =
    useMemo(() => {
      if (remainingSeconds <= 0) {
        return "Call timed out";
      }

      return `Auto-closing in ${remainingSeconds} second${
        remainingSeconds === 1
          ? ""
          : "s"
      }`;
    }, [remainingSeconds]);

  if (!open) {
    return null;
  }

  const handleAccept =
    async () => {
      if (isBusy) {
        return;
      }

      setAction("ACCEPT");

      try {
        await onAccept();
      } finally {
        setAction(null);
      }
    };

  const handleReject =
    async () => {
      if (isBusy) {
        return;
      }

      setAction("REJECT");

      try {
        await onReject();
      } finally {
        setAction(null);
      }
    };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-description"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-500 to-green-700 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />

              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-5xl shadow-lg ring-8 ring-white/10">
                {callIcon}
              </div>
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              Incoming call
            </p>

            <h2
              id="incoming-call-title"
              className="mt-2 text-2xl font-bold sm:text-3xl"
            >
              {normalizedCallerName}
            </h2>

            <p
              id="incoming-call-description"
              className="mt-2 text-sm text-white/85 sm:text-base"
            >
              {callLabel}
            </p>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="mb-6 rounded-2xl bg-gray-50 px-4 py-3 text-center">
            <p className="text-sm font-medium text-gray-600">
              {countdownLabel}
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (remainingSeconds /
                        safeTimeoutSeconds) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleReject}
              disabled={isBusy}
              className="rounded-2xl bg-red-600 px-4 py-3.5 font-semibold text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "REJECT"
                ? "Rejecting..."
                : "Reject"}
            </button>

            <button
              type="button"
              onClick={handleAccept}
              disabled={isBusy}
              className="rounded-2xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "ACCEPT"
                ? "Accepting..."
                : "Accept"}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            Press Esc to reject the call
          </p>
        </div>
      </div>
    </div>
  );
}