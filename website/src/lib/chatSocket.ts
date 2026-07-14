"use client";

import {
  io,
  type Socket,
} from "socket.io-client";

import type {
  ChatMessage,
  ChatMessageType,
} from "@/services/chatService";

export type ChatSocketErrorCode =
  | "INVALID_PAYLOAD"
  | "NOT_AUTHENTICATED"
  | "NOT_AUTHORIZED"
  | "CALL_SESSION_NOT_FOUND"
  | "CALL_SESSION_ENDED"
  | "CALL_SESSION_EXPIRED"
  | "ROOM_NOT_JOINED"
  | "MESSAGE_NOT_FOUND"
  | "MESSAGE_SEND_FAILED"
  | "INTERNAL_ERROR";

export type ChatConnectedPayload = {
  success: true;
  socketId: string;
  userId?: string;
  connectedAt?: string;
};

export type ChatJoinedPayload = {
  success: true;
  callSessionId: string;
  roomId: string;
  joinedAt?: string;
};

export type ChatLeftPayload = {
  success: true;
  callSessionId: string;
  roomId?: string;
  leftAt?: string;
};

export type ChatTypingPayload = {
  callSessionId: string;
  userId: string;
  userName?: string | null;
  isTyping: boolean;
  occurredAt?: string;
};

export type ChatReadPayload = {
  success: true;
  callSessionId: string;
  messageIds: string[];
  readerId?: string;
  updatedCount?: number;
  readAt: string;
};

export type ChatReadAllPayload = {
  success: true;
  callSessionId: string;
  readerId?: string;
  updatedCount: number;
  readAt: string;
};

export type ChatPresencePayload = {
  callSessionId: string;
  userId: string;
  isOnline: boolean;
  socketId?: string;
  lastSeenAt?: string | null;
};

export type ChatErrorPayload = {
  success: false;
  code?: ChatSocketErrorCode;
  message: string;
  callSessionId?: string;
  occurredAt?: string;
};

export type JoinChatRoomPayload = {
  callSessionId: string;
};

export type LeaveChatRoomPayload = {
  callSessionId: string;
};

export type SendRealtimeMessagePayload = {
  callSessionId: string;
  messageType?: ChatMessageType;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  clientMessageId?: string;
};

export type MarkRealtimeReadPayload = {
  callSessionId: string;
  messageIds: string[];
};

export type MarkRealtimeReadAllPayload = {
  callSessionId: string;
};

export type SendTypingStatusPayload = {
  callSessionId: string;
  isTyping: boolean;
};

type ServerToClientEvents = {
  "chat:connected": (
    payload: ChatConnectedPayload,
  ) => void;

  "chat:joined": (
    payload: ChatJoinedPayload,
  ) => void;

  "chat:left": (
    payload: ChatLeftPayload,
  ) => void;

  "chat:message": (
    payload: ChatMessage,
  ) => void;

  "chat:typing": (
    payload: ChatTypingPayload,
  ) => void;

  "chat:read": (
    payload: ChatReadPayload,
  ) => void;

  "chat:read-all": (
    payload: ChatReadAllPayload,
  ) => void;

  "chat:presence": (
    payload: ChatPresencePayload,
  ) => void;

  "chat:error": (
    payload: ChatErrorPayload,
  ) => void;
};

type ClientToServerEvents = {
  "chat:join": (
    payload: JoinChatRoomPayload,
  ) => void;

  "chat:leave": (
    payload: LeaveChatRoomPayload,
  ) => void;

  "chat:message": (
    payload: SendRealtimeMessagePayload,
  ) => void;

  "chat:typing": (
    payload: SendTypingStatusPayload,
  ) => void;

  "chat:read": (
    payload: MarkRealtimeReadPayload,
  ) => void;

  "chat:read-all": (
    payload: MarkRealtimeReadAllPayload,
  ) => void;
};

export type ChatSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

let socket: ChatSocket | null = null;

function getSocketBaseUrl(): string {
  const baseUrl =
    process.env
      .NEXT_PUBLIC_API_BASE_URL
      ?.trim() ||
    process.env
      .NEXT_PUBLIC_API_URL
      ?.trim();

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }

  return (
    window.localStorage.getItem(
      "asp_access_token",
    ) ?? ""
  ).trim();
}

function requireAccessToken(): string {
  const token =
    getAccessToken();

  if (!token) {
    throw new Error(
      "LOGIN_REQUIRED",
    );
  }

  return token;
}

function normalizeCallSessionId(
  callSessionId: string,
): string {
  const normalized =
    callSessionId?.trim();

  if (!normalized) {
    throw new Error(
      "Call session ID is required.",
    );
  }

  return normalized;
}

function updateSocketAuth(
  currentSocket: ChatSocket,
): void {
  const token =
    requireAccessToken();

  currentSocket.auth = {
    token,
  };
}

export function connectChatSocket():
  ChatSocket {
  const token =
    requireAccessToken();

  if (socket) {
    socket.auth = {
      token,
    };

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  socket = io(
    `${getSocketBaseUrl()}/chat`,
    {
      transports: [
        "websocket",
        "polling",
      ],

      autoConnect: false,
      withCredentials: true,

      auth: {
        token,
      },

      reconnection: true,
      reconnectionAttempts:
        Infinity,

      reconnectionDelay:
        1_000,

      reconnectionDelayMax:
        5_000,

      timeout:
        10_000,
    },
  );

  socket.on(
    "connect",
    () => {
      console.log(
        "[CHAT] Connected:",
        socket?.id,
      );
    },
  );

  socket.on(
    "disconnect",
    (reason) => {
      console.log(
        "[CHAT] Disconnected:",
        reason,
      );
    },
  );

  socket.on(
    "connect_error",
    (error) => {
      console.error(
        "[CHAT] Connection error:",
        error.message,
      );
    },
  );

  socket.on(
    "chat:error",
    (payload) => {
      console.error(
        `[CHAT] ${
          payload.code ??
          "ERROR"
        }:`,
        payload.message,
      );
    },
  );

  socket.connect();

  return socket;
}

export function refreshChatSocketAuth():
  ChatSocket {
  const currentSocket =
    socket ??
    connectChatSocket();

  updateSocketAuth(
    currentSocket,
  );

  if (currentSocket.connected) {
    currentSocket.disconnect();
  }

  currentSocket.connect();

  return currentSocket;
}

export function disconnectChatSocket():
  void {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function getChatSocket():
  ChatSocket | null {
  return socket;
}

export function isChatSocketConnected():
  boolean {
  return Boolean(
    socket?.connected,
  );
}

export function joinChatRoom(
  callSessionId: string,
): boolean {
  const currentSocket =
    socket;

  if (!currentSocket?.connected) {
    console.error(
      "[CHAT] Cannot join room: socket is not connected.",
    );

    return false;
  }

  currentSocket.emit(
    "chat:join",
    {
      callSessionId:
        normalizeCallSessionId(
          callSessionId,
        ),
    },
  );

  return true;
}

export function leaveChatRoom(
  callSessionId: string,
): boolean {
  const currentSocket =
    socket;

  if (!currentSocket?.connected) {
    return false;
  }

  currentSocket.emit(
    "chat:leave",
    {
      callSessionId:
        normalizeCallSessionId(
          callSessionId,
        ),
    },
  );

  return true;
}

export function sendRealtimeMessage(
  payload: SendRealtimeMessagePayload,
): boolean {
  const currentSocket =
    socket;

  if (!currentSocket?.connected) {
    console.error(
      "[CHAT] Cannot send message: socket is not connected.",
    );

    return false;
  }

  const callSessionId =
    normalizeCallSessionId(
      payload.callSessionId,
    );

  const messageType =
    payload.messageType ??
    "TEXT";

  const content =
    payload.content?.trim();

  const attachmentUrl =
    payload.attachmentUrl?.trim();

  if (
    (messageType === "TEXT" ||
      messageType ===
        "SYSTEM") &&
    !content
  ) {
    throw new Error(
      "Message content is required.",
    );
  }

  if (
    (messageType === "IMAGE" ||
      messageType ===
        "FILE") &&
    !attachmentUrl
  ) {
    throw new Error(
      "Attachment URL is required.",
    );
  }

  currentSocket.emit(
    "chat:message",
    {
      callSessionId,
      messageType,
      content,
      attachmentUrl,
      attachmentName:
        payload.attachmentName?.trim(),
      attachmentMimeType:
        payload.attachmentMimeType?.trim(),
      attachmentSize:
        payload.attachmentSize,
      clientMessageId:
        payload.clientMessageId?.trim(),
    },
  );

  return true;
}

export function markRealtimeRead(
  callSessionId: string,
  messageIds: string[],
): boolean {
  const currentSocket =
    socket;

  if (!currentSocket?.connected) {
    return false;
  }

  const normalizedMessageIds = [
    ...new Set(
      messageIds
        .map((id) =>
          id.trim(),
        )
        .filter(Boolean),
    ),
  ];

  if (
    normalizedMessageIds.length ===
    0
  ) {
    return false;
  }

  currentSocket.emit(
    "chat:read",
    {
      callSessionId:
        normalizeCallSessionId(
          callSessionId,
        ),
      messageIds:
        normalizedMessageIds,
    },
  );

  return true;
}

export function markRealtimeReadAll(
  callSessionId: string,
): boolean {
  const currentSocket =
    socket;

  if (!currentSocket?.connected) {
    return false;
  }

  currentSocket.emit(
    "chat:read-all",
    {
      callSessionId:
        normalizeCallSessionId(
          callSessionId,
        ),
    },
  );

  return true;
}

export function sendTypingStatus(
  callSessionId: string,
  isTyping: boolean,
): boolean {
  const currentSocket =
    socket;

  if (!currentSocket?.connected) {
    return false;
  }

  currentSocket.emit(
    "chat:typing",
    {
      callSessionId:
        normalizeCallSessionId(
          callSessionId,
        ),
      isTyping:
        Boolean(isTyping),
    },
  );

  return true;
}

function subscribe<
  EventName extends keyof ServerToClientEvents,
>(
  eventName: EventName,
  callback:
    ServerToClientEvents[EventName],
): () => void {
  if (!socket) {
    throw new Error(
      "Chat socket has not been connected. Call connectChatSocket() first.",
    );
  }

  const currentSocket =
    socket;

  currentSocket.on(
    eventName,
    callback as never,
  );

  return () => {
    currentSocket.off(
      eventName,
      callback as never,
    );
  };
}

export function onChatConnected(
  callback: (
    payload: ChatConnectedPayload,
  ) => void,
): () => void {
  return subscribe(
    "chat:connected",
    callback,
  );
}

export function onChatJoined(
  callback: (
    payload: ChatJoinedPayload,
  ) => void,
): () => void {
  return subscribe(
    "chat:joined",
    callback,
  );
}

export function onChatLeft(
  callback: (
    payload: ChatLeftPayload,
  ) => void,
): () => void {
  return subscribe(
    "chat:left",
    callback,
  );
}

export function onNewMessage(
  callback: (
    message: ChatMessage,
  ) => void,
): () => void {
  return subscribe(
    "chat:message",
    callback,
  );
}

export function onTyping(
  callback: (
    payload: ChatTypingPayload,
  ) => void,
): () => void {
  return subscribe(
    "chat:typing",
    callback,
  );
}

export function onReadReceipt(
  callback: (
    payload:
      | ChatReadPayload
      | ChatReadAllPayload,
  ) => void,
): () => void {
  const cleanupRead =
    subscribe(
      "chat:read",
      callback as (
        payload:
          ChatReadPayload,
      ) => void,
    );

  const cleanupReadAll =
    subscribe(
      "chat:read-all",
      callback as (
        payload:
          ChatReadAllPayload,
      ) => void,
    );

  return () => {
    cleanupRead();
    cleanupReadAll();
  };
}

export function onPresence(
  callback: (
    payload: ChatPresencePayload,
  ) => void,
): () => void {
  return subscribe(
    "chat:presence",
    callback,
  );
}

export function onChatError(
  callback: (
    payload: ChatErrorPayload,
  ) => void,
): () => void {
  return subscribe(
    "chat:error",
    callback,
  );
}

export function removeAllChatListeners():
  void {
  if (!socket) {
    return;
  }

  socket.removeAllListeners(
    "chat:connected",
  );
  socket.removeAllListeners(
    "chat:joined",
  );
  socket.removeAllListeners(
    "chat:left",
  );
  socket.removeAllListeners(
    "chat:message",
  );
  socket.removeAllListeners(
    "chat:typing",
  );
  socket.removeAllListeners(
    "chat:read",
  );
  socket.removeAllListeners(
    "chat:read-all",
  );
  socket.removeAllListeners(
    "chat:presence",
  );
  socket.removeAllListeners(
    "chat:error",
  );
}