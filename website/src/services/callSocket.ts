"use client";

import {
  io,
  type Socket,
} from "socket.io-client";

export type ConsultationType =
  | "AUDIO"
  | "VIDEO";

export type CallErrorCode =
  | "INVALID_PAYLOAD"
  | "NOT_REGISTERED"
  | "IDENTITY_MISMATCH"
  | "SELF_CALL_NOT_ALLOWED"
  | "CALL_ALREADY_RINGING"
  | "USER_ALREADY_BUSY"
  | "RECIPIENT_UNAVAILABLE"
  | "CALL_NOT_FOUND"
  | "PARTICIPANT_MISMATCH"
  | "UNAUTHORIZED_ACTION";

export type CallConnectedPayload = {
  success: true;
  socketId: string;
  connectedAt?: string;
};

export type CallRegisteredPayload = {
  success: true;
  userId: string;
  socketId: string;
  registeredAt?: string;
};

export type IncomingCallPayload = {
  success: true;
  callId: string;
  callerId: string;
  callerUserId: string;
  callerName: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "RINGING";
  initiatedAt: string;
  timeoutSeconds: number;
};

export type CallRingingPayload = {
  success: true;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "RINGING";
  initiatedAt: string;
  timeoutSeconds: number;
};

export type CallAcceptedPayload = {
  success: true;
  callId: string;
  callerUserId: string;
  receiverUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "ACCEPTED";
  acceptedAt: string;
};

export type CallRejectedPayload = {
  success: true;
  callId: string;
  callerUserId: string;
  receiverUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "REJECTED";
  reason: string;
  rejectedAt: string;
};

export type CallMissedPayload = {
  success: true;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "MISSED";
  reason: string;
  missedAt: string;
};

export type CallCancelledPayload = {
  success: true;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "CANCELLED";
  reason: string;
  cancelledAt: string;
};

export type CallUnavailablePayload = {
  success: false;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "UNAVAILABLE";
  reason: string;
  failedAt: string;
};

export type CallErrorPayload = {
  success: false;
  code: CallErrorCode;
  message: string;
  occurredAt: string;
};

export type AcceptCallPayload = {
  callId: string;
  callerUserId: string;
  receiverUserId: string;
};

export type RejectCallPayload = {
  callId: string;
  callerUserId: string;
  receiverUserId: string;
  reason?: string;
};

export type InitiateCallPayload = {
  callId: string;
  recipientUserId: string;
  callerId: string;
  callerName?: string;
  consultationType?: ConsultationType;
};

export type CancelCallPayload = {
  callId: string;
  callerUserId?: string;
  recipientUserId: string;
  reason?: string;
};

type ServerToClientEvents = {
  "call:connected": (
    payload: CallConnectedPayload,
  ) => void;

  "call:registered": (
    payload: CallRegisteredPayload,
  ) => void;

  "call:incoming": (
    payload: IncomingCallPayload,
  ) => void;

  "call:ringing": (
    payload: CallRingingPayload,
  ) => void;

  "call:accepted": (
    payload: CallAcceptedPayload,
  ) => void;

  "call:accept-confirmed": (
    payload: CallAcceptedPayload,
  ) => void;

  "call:rejected": (
    payload: CallRejectedPayload,
  ) => void;

  "call:reject-confirmed": (
    payload: CallRejectedPayload,
  ) => void;

  "call:missed": (
    payload: CallMissedPayload,
  ) => void;

  "call:cancelled": (
    payload: CallCancelledPayload,
  ) => void;

  "call:cancel-confirmed": (
    payload: CallCancelledPayload,
  ) => void;

  "call:unavailable": (
    payload: CallUnavailablePayload,
  ) => void;

  "call:error": (
    payload: CallErrorPayload,
  ) => void;
};

type ClientToServerEvents = {
  "call:register": (
    payload: {
      userId: string;
    },
  ) => void;

  "call:initiate": (
    payload: InitiateCallPayload,
  ) => void;

  "call:accept": (
    payload: AcceptCallPayload,
  ) => void;

  "call:reject": (
    payload: RejectCallPayload,
  ) => void;

  "call:cancel": (
    payload: CancelCallPayload,
  ) => void;
};

export type CallSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

let socket: CallSocket | null = null;
let registeredUserId = "";

function getBaseUrl(): string {
  const baseUrl =
    process.env
      .NEXT_PUBLIC_API_BASE_URL
      ?.trim()
      .replace(/\/+$/, "") ||
    process.env
      .NEXT_PUBLIC_API_URL
      ?.trim()
      .replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return baseUrl;
}

function registerCurrentUser(): void {
  if (
    !socket?.connected ||
    !registeredUserId
  ) {
    return;
  }

  socket.emit("call:register", {
    userId: registeredUserId,
  });
}

export function connectCallSocket(
  userId: string,
): CallSocket {
  const normalizedUserId =
    userId?.trim();

  if (!normalizedUserId) {
    throw new Error(
      "User ID is required to connect the call socket.",
    );
  }

  registeredUserId =
    normalizedUserId;

  if (socket) {
    if (socket.connected) {
      registerCurrentUser();
    } else {
      socket.connect();
    }

    return socket;
  }

  socket = io(
    `${getBaseUrl()}/call`,
    {
      transports: [
        "websocket",
        "polling",
      ],

      withCredentials: true,
      autoConnect: false,

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
      registerCurrentUser();

      console.log(
        "[CALL] Connected:",
        socket?.id,
      );
    },
  );

  socket.on(
    "call:connected",
    (payload) => {
      console.log(
        "[CALL] Gateway connected:",
        payload,
      );
    },
  );

  socket.on(
    "call:registered",
    (payload) => {
      console.log(
        "[CALL] User registered:",
        payload.userId,
      );
    },
  );

  socket.on(
    "disconnect",
    (reason) => {
      console.log(
        "[CALL] Disconnected:",
        reason,
      );
    },
  );

  socket.on(
    "connect_error",
    (error) => {
      console.error(
        "[CALL] Connection error:",
        error.message,
      );
    },
  );

  socket.on(
    "call:error",
    (payload) => {
      console.error(
        `[CALL] ${payload.code}:`,
        payload.message,
      );
    },
  );

  socket.connect();

  return socket;
}

export function getCallSocket():
  CallSocket | null {
  return socket;
}

export function isCallSocketConnected():
  boolean {
  return Boolean(
    socket?.connected,
  );
}

export function disconnectCallSocket():
  void {
  if (!socket) {
    registeredUserId = "";
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();

  socket = null;
  registeredUserId = "";
}

export function initiateCall(
  payload: InitiateCallPayload,
): boolean {
  if (!socket?.connected) {
    console.error(
      "[CALL] Cannot initiate: socket is not connected.",
    );

    return false;
  }

  socket.emit(
    "call:initiate",
    {
      ...payload,

      callerName:
        payload.callerName?.trim() ||
        "Astro Soul Path User",

      consultationType:
        payload.consultationType ??
        "AUDIO",
    },
  );

  return true;
}

export function acceptCall(
  payload: AcceptCallPayload,
): boolean {
  if (!socket?.connected) {
    console.error(
      "[CALL] Cannot accept: socket is not connected.",
    );

    return false;
  }

  socket.emit(
    "call:accept",
    payload,
  );

  return true;
}

export function rejectCall(
  payload: RejectCallPayload,
): boolean {
  if (!socket?.connected) {
    console.error(
      "[CALL] Cannot reject: socket is not connected.",
    );

    return false;
  }

  socket.emit(
    "call:reject",
    {
      ...payload,

      reason:
        payload.reason?.trim() ||
        "The call was rejected.",
    },
  );

  return true;
}

export function cancelCall(
  payload: CancelCallPayload,
): boolean {
  if (!socket?.connected) {
    console.error(
      "[CALL] Cannot cancel: socket is not connected.",
    );

    return false;
  }

  socket.emit(
    "call:cancel",
    {
      ...payload,

      reason:
        payload.reason?.trim() ||
        "The caller cancelled the call.",
    },
  );

  return true;
}

export function onIncomingCall(
  callback: (
    payload: IncomingCallPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:incoming",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:incoming",
      callback,
    );
  };
}

export function onCallRinging(
  callback: (
    payload: CallRingingPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:ringing",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:ringing",
      callback,
    );
  };
}

export function onCallAccepted(
  callback: (
    payload: CallAcceptedPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:accepted",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:accepted",
      callback,
    );
  };
}

export function onCallRejected(
  callback: (
    payload: CallRejectedPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:rejected",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:rejected",
      callback,
    );
  };
}

export function onCallMissed(
  callback: (
    payload: CallMissedPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:missed",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:missed",
      callback,
    );
  };
}

export function onCallCancelled(
  callback: (
    payload: CallCancelledPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:cancelled",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:cancelled",
      callback,
    );
  };
}

export function onCallUnavailable(
  callback: (
    payload: CallUnavailablePayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:unavailable",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:unavailable",
      callback,
    );
  };
}

export function onCallError(
  callback: (
    payload: CallErrorPayload,
  ) => void,
): () => void {
  const currentSocket =
    requireSocket();

  currentSocket.on(
    "call:error",
    callback,
  );

  return () => {
    currentSocket.off(
      "call:error",
      callback,
    );
  };
}

function requireSocket():
  CallSocket {
  if (!socket) {
    throw new Error(
      "Call socket has not been connected. Call connectCallSocket() first.",
    );
  }

  return socket;
}