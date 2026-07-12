"use client";

import { io, Socket } from "socket.io-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

let socket: Socket | null = null;

function getSocketUrl() {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    localStorage.getItem(
      "asp_access_token",
    ) ?? ""
  );
}

export function connectChatSocket() {
  if (socket?.connected) {
    return socket;
  }

  socket = io(`${getSocketUrl()}/chat`, {
    transports: ["websocket"],
    autoConnect: true,

    auth: {
      token: getAccessToken(),
    },
  });

  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}

export function getChatSocket() {
  return socket;
}

export function joinChatRoom(
  callSessionId: string,
) {
  socket?.emit("chat:join", {
    callSessionId,
  });
}

export function leaveChatRoom(
  callSessionId: string,
) {
  socket?.emit("chat:leave", {
    callSessionId,
  });
}

export function sendRealtimeMessage(
  payload: {
    callSessionId: string;
    messageType?:
      | "TEXT"
      | "IMAGE"
      | "FILE"
      | "SYSTEM";
    content?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentMimeType?: string;
    attachmentSize?: number;
  },
) {
  socket?.emit(
    "chat:message",
    payload,
  );
}

export function markRealtimeRead(
  callSessionId: string,
  messageIds: string[],
) {
  socket?.emit("chat:read", {
    callSessionId,
    messageIds,
  });
}

export function markRealtimeReadAll(
  callSessionId: string,
) {
  socket?.emit("chat:read-all", {
    callSessionId,
  });
}

export function sendTypingStatus(
  callSessionId: string,
  isTyping: boolean,
) {
  socket?.emit("chat:typing", {
    callSessionId,
    isTyping,
  });
}

export function onChatConnected(
  callback: (data: unknown) => void,
) {
  socket?.on(
    "chat:connected",
    callback,
  );
}

export function onChatJoined(
  callback: (data: unknown) => void,
) {
  socket?.on(
    "chat:joined",
    callback,
  );
}

export function onNewMessage(
  callback: (message: unknown) => void,
) {
  socket?.on(
    "chat:message",
    callback,
  );
}

export function onTyping(
  callback: (data: unknown) => void,
) {
  socket?.on(
    "chat:typing",
    callback,
  );
}

export function onReadReceipt(
  callback: (data: unknown) => void,
) {
  socket?.on(
    "chat:read",
    callback,
  );

  socket?.on(
    "chat:read-all",
    callback,
  );
}

export function onPresence(
  callback: (data: unknown) => void,
) {
  socket?.on(
    "chat:presence",
    callback,
  );
}

export function onChatError(
  callback: (data: unknown) => void,
) {
  socket?.on(
    "chat:error",
    callback,
  );
}

export function removeAllChatListeners() {
  socket?.removeAllListeners();
}