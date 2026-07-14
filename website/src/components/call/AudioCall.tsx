"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAgoraCall } from "@/hooks/useAgoraCall";
import { endCall } from "@/services/callService";

type AudioCallProps = {
  callId: string;
  appId: string;
  channelName: string;
  token: string;
  uid: number;

  /**
   * Incoming call accept hone ke baad
   * Agora automatically join karega.
   */
  autoJoin?: boolean;

  /**
   * Backend call expiry time.
   * ISO date string ya Date object pass kar sakte hain.
   */
  expiresAt?: string | Date | null;

  /**
   * Other participant ka display name.
   */
  participantName?: string;

  /**
   * Call successfully close hone ke baad
   * parent page ko notify karega.
   */
  onEnd?: () => void;
};

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : fallback;
}

function formatDuration(
  totalSeconds: number,
): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  );

  const hours = Math.floor(
    safeSeconds / 3600,
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );

  const seconds =
    safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(
      2,
      "0",
    )}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(
      2,
      "0",
    )}`;
  }

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

export default function AudioCall({
  callId,
  appId,
  channelName,
  token,
  uid,
  autoJoin = false,
  expiresAt = null,
  participantName = "Astrologer",
  onEnd,
}: AudioCallProps) {
  const {
    connected,
    muted,
    remoteUsers,
    join,
    leave,
    toggleMute,
  } = useAgoraCall();

  const [joining, setJoining] =
    useState(false);

  const [ending, setEnding] =
    useState(false);

  const [seconds, setSeconds] =
    useState(0);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState<number | null>(
    null,
  );

  const [error, setError] =
    useState("");

  const autoJoinAttemptedRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const endingRef =
    useRef(false);

  const leaveRef =
    useRef(leave);

  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasValidConfiguration =
    Boolean(
      callId.trim() &&
        appId.trim() &&
        channelName.trim() &&
        token.trim() &&
        Number.isInteger(uid) &&
        uid > 0,
    );

  const normalizedParticipantName =
    participantName.trim() ||
    "Astrologer";

  const handleJoin =
    useCallback(async () => {
      if (
        connected ||
        joining ||
        ending ||
        endingRef.current
      ) {
        return;
      }

      if (!hasValidConfiguration) {
        setError(
          "Audio call configuration is incomplete.",
        );

        return;
      }

      try {
        setJoining(true);
        setError("");

        await join(
          appId.trim(),
          channelName.trim(),
          token.trim(),
          uid,
        );
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setError(
          getErrorMessage(
            error,
            "Unable to join audio call.",
          ),
        );
      } finally {
        if (mountedRef.current) {
          setJoining(false);
        }
      }
    }, [
      appId,
      channelName,
      connected,
      ending,
      hasValidConfiguration,
      join,
      joining,
      token,
      uid,
    ]);

  useEffect(() => {
    if (
      !autoJoin ||
      connected ||
      joining ||
      ending ||
      autoJoinAttemptedRef.current
    ) {
      return;
    }

    autoJoinAttemptedRef.current =
      true;

    void handleJoin();
  }, [
    autoJoin,
    connected,
    ending,
    handleJoin,
    joining,
  ]);

  useEffect(() => {
    autoJoinAttemptedRef.current =
      false;

    setSeconds(0);
    setError("");
  }, [
    callId,
    channelName,
    token,
    uid,
  ]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const timerId =
      window.setInterval(() => {
        setSeconds(
          (previousSeconds) =>
            previousSeconds + 1,
        );
      }, 1_000);

    return () => {
      window.clearInterval(
        timerId,
      );
    };
  }, [connected]);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(null);
      return;
    }

    const expiryTimestamp =
      new Date(expiresAt).getTime();

    if (
      !Number.isFinite(
        expiryTimestamp,
      )
    ) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemainingTime =
      () => {
        const nextSeconds =
          Math.max(
            0,
            Math.ceil(
              (expiryTimestamp -
                Date.now()) /
                1000,
            ),
          );

        setRemainingSeconds(
          nextSeconds,
        );
      };

    updateRemainingTime();

    const timerId =
      window.setInterval(
        updateRemainingTime,
        1_000,
      );

    return () => {
      window.clearInterval(
        timerId,
      );
    };
  }, [expiresAt]);

  useEffect(() => {
    return () => {
      void leaveRef
        .current()
        .catch(() => {
          // Unmount cleanup error intentionally ignored.
        });
    };
  }, []);

  const handleLeave =
    useCallback(async () => {
      if (
        ending ||
        endingRef.current
      ) {
        return;
      }

      endingRef.current = true;

      try {
        setEnding(true);
        setError("");

        if (connected) {
          await leave();
        }

        await endCall(callId);

        if (mountedRef.current) {
          setSeconds(0);
          setRemainingSeconds(0);
        }

        onEnd?.();
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setError(
          getErrorMessage(
            error,
            "Unable to end audio call.",
          ),
        );
      } finally {
        endingRef.current = false;

        if (mountedRef.current) {
          setEnding(false);
        }
      }
    }, [
      callId,
      connected,
      ending,
      leave,
      onEnd,
    ]);

  useEffect(() => {
    if (
      remainingSeconds !== 0 ||
      ending ||
      endingRef.current
    ) {
      return;
    }

    void handleLeave();
  }, [
    ending,
    handleLeave,
    remainingSeconds,
  ]);

  const handleToggleMute =
    useCallback(async () => {
      if (
        !connected ||
        ending ||
        endingRef.current
      ) {
        return;
      }

      try {
        setError("");
        await toggleMute();
      } catch (error) {
        setError(
          getErrorMessage(
            error,
            "Unable to change microphone status.",
          ),
        );
      }
    }, [
      connected,
      ending,
      toggleMute,
    ]);

  const formattedDuration =
    useMemo(
      () =>
        formatDuration(seconds),
      [seconds],
    );

  const formattedRemainingTime =
    useMemo(
      () =>
        remainingSeconds === null
          ? null
          : formatDuration(
              remainingSeconds,
            ),
      [remainingSeconds],
    );

  const statusText = connected
    ? remoteUsers.length > 0
      ? "Connected"
      : "Waiting for participant"
    : joining
      ? "Connecting..."
      : ending
        ? "Ending..."
        : autoJoin
          ? "Waiting to connect"
          : "Disconnected";

  const statusClasses = connected
    ? remoteUsers.length > 0
      ? "bg-green-100 text-green-700"
      : "bg-blue-100 text-blue-700"
    : joining
      ? "bg-yellow-100 text-yellow-700"
      : ending
        ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-600";

  return (
    <section
      className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl"
      aria-label="Audio consultation"
    >
      <div className="bg-gradient-to-br from-[#111936] to-[#202B57] px-6 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Live consultation
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Audio Consultation
            </h2>

            <p className="mt-1 text-sm text-white/70">
              Secure session with{" "}
              {normalizedParticipantName}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
          >
            {statusText}
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {autoJoin &&
          !connected &&
          joining &&
          !error && (
            <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              Call accepted. Connecting audio automatically...
            </div>
          )}

        {remainingSeconds === 0 &&
          !ending && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Consultation time has ended. Closing the call...
            </div>
          )}

        <div className="flex flex-col items-center py-4 text-center">
          <div className="relative">
            {connected && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" />
            )}

            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100 text-5xl shadow-inner ring-8 ring-emerald-50">
              🎙️
            </div>
          </div>

          <h3 className="mt-5 text-xl font-bold text-[#0B1026]">
            {normalizedParticipantName}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {remoteUsers.length > 0
              ? "Participant joined"
              : connected
                ? "Waiting for participant to join"
                : "Audio channel not connected"}
          </p>

          <p className="mt-4 font-mono text-3xl font-bold tracking-wider text-[#0B1026]">
            {formattedDuration}
          </p>

          {formattedRemainingTime && (
            <p className="mt-2 text-sm font-medium text-gray-500">
              Remaining:{" "}
              {formattedRemainingTime}
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Connection
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              {statusText}
            </p>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Participant
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              {remoteUsers.length > 0
                ? "Joined"
                : "Not joined"}
            </p>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Microphone
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              {connected
                ? muted
                  ? "Muted"
                  : "On"
                : "Unavailable"}
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {!connected ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void handleJoin()
                }
                disabled={
                  joining ||
                  ending ||
                  !hasValidConfiguration
                }
                className="min-w-40 rounded-2xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joining
                  ? "Joining..."
                  : autoJoin
                    ? "Reconnect Audio"
                    : "Join Audio"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleLeave()
                }
                disabled={ending}
                className="min-w-40 rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ending
                  ? "Ending..."
                  : "Cancel Call"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  void handleToggleMute()
                }
                disabled={ending}
                className={`min-w-40 rounded-2xl px-6 py-3 font-semibold text-white shadow-md transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                  muted
                    ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200"
                    : "bg-amber-500 hover:bg-amber-600 focus:ring-amber-200"
                }`}
              >
                {muted
                  ? "Unmute"
                  : "Mute"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleLeave()
                }
                disabled={ending}
                className="min-w-40 rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ending
                  ? "Ending..."
                  : "End Call"}
              </button>
            </>
          )}
        </div>

        {!connected &&
          autoJoin &&
          !joining &&
          !ending &&
          !error && (
            <p className="mt-5 text-center text-xs text-gray-500">
              Automatic connection was interrupted. Select Reconnect Audio to try again.
            </p>
          )}
      </div>
    </section>
  );
}