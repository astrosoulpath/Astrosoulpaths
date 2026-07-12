"use client";

import { useEffect, useState } from "react";
import agoraService from "@/services/agoraService";

export function useAgoraCall() {
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);

  useEffect(() => {
    const client = agoraService.getClient();

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);

      if (mediaType === "audio") {
        user.audioTrack?.play();
      }

      setRemoteUsers((prev) => {
        if (prev.includes(user.uid as number)) {
          return prev;
        }

        return [...prev, user.uid as number];
      });
    });

    client.on("user-unpublished", (user) => {
      setRemoteUsers((prev) =>
        prev.filter((id) => id !== user.uid),
      );
    });

    client.on("user-left", (user) => {
      setRemoteUsers((prev) =>
        prev.filter((id) => id !== user.uid),
      );
    });

    return () => {
      client.removeAllListeners();
    };
  }, []);

  async function join(
    appId: string,
    channel: string,
    token: string,
    uid: number,
  ) {
    await agoraService.join(
      appId,
      channel,
      token,
      uid,
    );

    setConnected(true);
  }

  async function leave() {
    await agoraService.leave();

    setConnected(false);

    setRemoteUsers([]);
  }

  async function toggleMute() {
    await agoraService.mute(!muted);

    setMuted(!muted);
  }

  return {
    connected,
    muted,
    remoteUsers,
    join,
    leave,
    toggleMute,
  };
}