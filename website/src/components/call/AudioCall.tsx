"use client";

import { useEffect, useState } from "react";

import { useAgoraCall } from "@/hooks/useAgoraCall";
import { endCall } from "@/services/callService";

type AudioCallProps = {
  callId: string;
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  onEnd?: () => void;
};

export default function AudioCall({
  callId,
  appId,
  channelName,
  token,
  uid,
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

  useEffect(() => {
    if (!connected) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [connected]);

  async function handleJoin() {
    try {
      setJoining(true);

      await join(
        appId,
        channelName,
        token,
        uid,
      );
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    try {
      setEnding(true);

      await endCall(callId);

      await leave();

      onEnd?.();
    } finally {
      setEnding(false);
    }
  }

  const minutes = Math.floor(
    seconds / 60,
  );

  const remainingSeconds =
    seconds % 60;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-lg">
      <h2 className="text-xl font-bold">
        Audio Consultation
      </h2>

      <div className="mt-4 space-y-2 text-sm">

        <div>
          Status{" "}
          <strong>
            {connected
              ? "Connected"
              : "Disconnected"}
          </strong>
        </div>

        <div>
          Remote Users{" "}
          <strong>
            {remoteUsers.length}
          </strong>
        </div>

        <div>
          Microphone{" "}
          <strong>
            {muted
              ? "Muted"
              : "On"}
          </strong>
        </div>

        <div>
          Duration{" "}
          <strong>
            {minutes}
            :
            {remainingSeconds
              .toString()
              .padStart(2, "0")}
          </strong>
        </div>

      </div>

      <div className="mt-6 flex flex-wrap gap-3">

        {!connected ? (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white"
          >
            {joining
              ? "Joining..."
              : "Join Audio"}
          </button>
        ) : (
          <>

            <button
              onClick={toggleMute}
              className="rounded-lg bg-yellow-500 px-5 py-3 font-semibold text-white"
            >
              {muted
                ? "Unmute"
                : "Mute"}
            </button>

            <button
              onClick={handleLeave}
              disabled={ending}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white"
            >
              {ending
                ? "Ending..."
                : "End Call"}
            </button>

          </>
        )}

      </div>
    </div>
  );
}