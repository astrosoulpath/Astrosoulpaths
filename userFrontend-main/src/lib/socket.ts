import {
  io,
  type Socket,
} from "socket.io-client";

export type ConsultationType =
  | "AUDIO"
  | "VIDEO";

export type CallStatus =
  | "RINGING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "MISSED"
  | "UNAVAILABLE";

export type CallConnectedPayload = {
  success: boolean;
  socketId: string;
  connectedAt?: string;
};

export type CallRegisteredPayload = {
  success: boolean;
  userId: string;
  socketId: string;
  registeredAt?: string;
};

export type IncomingCallPayload = {
  success: boolean;
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
  success: boolean;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "RINGING";
  initiatedAt: string;
  timeoutSeconds: number;
};

export type CallAcceptedPayload = {
  success: boolean;
  callId: string;
  callerUserId: string;
  receiverUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "ACCEPTED";
  acceptedAt: string;
};

export type CallRejectedPayload = {
  success: boolean;
  callId: string;
  callerUserId: string;
  receiverUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "REJECTED";
  reason: string;
  rejectedAt: string;
};

export type CallCancelledPayload = {
  success: boolean;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "CANCELLED";
  reason: string;
  cancelledAt: string;
};

export type CallMissedPayload = {
  success: boolean;
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status: "MISSED";
  reason: string;
  missedAt: string;
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
  code:
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
  message: string;
  occurredAt: string;
};

export type RegisterCallPayload = {
  userId: string;
};

export type InitiateCallPayload = {
  callId: string;
  recipientUserId: string;
  callerId: string;
  callerName?: string;
  consultationType?: ConsultationType;
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

export type CancelCallPayload = {
  callId: string;
  callerUserId?: string;
  recipientUserId: string;
  reason?: string;
};

type InitiateCallResponse =
  | CallRingingPayload
  | CallUnavailablePayload
  | CallErrorPayload;

type AcceptCallResponse =
  | CallAcceptedPayload
  | CallErrorPayload;

type RejectCallResponse =
  | CallRejectedPayload
  | CallErrorPayload;

type CancelCallResponse =
  | CallCancelledPayload
  | CallErrorPayload;

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

  "call:cancelled": (
    payload: CallCancelledPayload,
  ) => void;

  "call:cancel-confirmed": (
    payload: CallCancelledPayload,
  ) => void;

  "call:missed": (
    payload: CallMissedPayload,
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
    payload: RegisterCallPayload,
    callback?: (
      response:
        | CallRegisteredPayload
        | CallErrorPayload,
    ) => void,
  ) => void;

  "call:initiate": (
    payload: InitiateCallPayload,
    callback?: (
      response: InitiateCallResponse,
    ) => void,
  ) => void;

  "call:accept": (
    payload: AcceptCallPayload,
    callback?: (
      response: AcceptCallResponse,
    ) => void,
  ) => void;

  "call:reject": (
    payload: RejectCallPayload,
    callback?: (
      response: RejectCallResponse,
    ) => void,
  ) => void;

  "call:cancel": (
    payload: CancelCallPayload,
    callback?: (
      response: CancelCallResponse,
    ) => void,
  ) => void;
};

export type CallSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

let callSocket: CallSocket | null =
  null;

const SOCKET_RESPONSE_TIMEOUT =
  10_000;

function getBackendUrl(): string {
  const backendUrl =
    process.env
      .EXPO_PUBLIC_API_BASE_URL
      ?.trim() ||
    process.env
      .EXPO_PUBLIC_BACKEND_URL
      ?.trim() ||
    "http://localhost:4000";

  return backendUrl.replace(
    /\/+$/,
    "",
  );
}

export function getCallSocket(): CallSocket {
  if (callSocket) {
    return callSocket;
  }

  callSocket = io(
    `${getBackendUrl()}/call`,
    {
      transports: [
        "websocket",
        "polling",
      ],

      withCredentials: true,
      autoConnect: false,

      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,

      timeout: 10_000,
    },
  );

  return callSocket;
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

  const socket =
    getCallSocket();

  const registerUser = () => {
    socket.emit(
      "call:register",
      {
        userId:
          normalizedUserId,
      },
      (response) => {
        if (!response.success) {
          console.warn(
            "Call socket registration failed.",
            response,
          );
        }
      },
    );
  };

  socket.off(
    "connect",
    registerUser,
  );

  socket.on(
    "connect",
    registerUser,
  );

  if (!socket.connected) {
    socket.connect();
  } else {
    registerUser();
  }

  return socket;
}

export function disconnectCallSocket(): void {
  if (!callSocket) {
    return;
  }

  callSocket.removeAllListeners();
  callSocket.disconnect();
  callSocket = null;
}

export function initiateCall(
  payload: InitiateCallPayload,
): Promise<InitiateCallResponse> {
  const socket =
    getCallSocket();

  return createSocketRequest(
    "call:initiate",
    (resolve) => {
      socket.emit(
        "call:initiate",
        payload,
        resolve,
      );
    },
  );
}

export function acceptCall(
  payload: AcceptCallPayload,
): Promise<AcceptCallResponse> {
  const socket =
    getCallSocket();

  return createSocketRequest(
    "call:accept",
    (resolve) => {
      socket.emit(
        "call:accept",
        payload,
        resolve,
      );
    },
  );
}

export function rejectCall(
  payload: RejectCallPayload,
): Promise<RejectCallResponse> {
  const socket =
    getCallSocket();

  return createSocketRequest(
    "call:reject",
    (resolve) => {
      socket.emit(
        "call:reject",
        payload,
        resolve,
      );
    },
  );
}

export function cancelCall(
  payload: CancelCallPayload,
): Promise<CancelCallResponse> {
  const socket =
    getCallSocket();

  return createSocketRequest(
    "call:cancel",
    (resolve) => {
      socket.emit(
        "call:cancel",
        payload,
        resolve,
      );
    },
  );
}

function createSocketRequest<Response>(
  eventName: string,
  emitRequest: (
    resolve: (
      response: Response,
    ) => void,
  ) => void,
): Promise<Response> {
  const socket =
    getCallSocket();

  return new Promise<Response>(
    (resolve, reject) => {
      if (!socket.connected) {
        reject(
          new Error(
            "Call socket is not connected.",
          ),
        );

        return;
      }

      let completed = false;

      const timeoutId =
        globalThis.setTimeout(
          () => {
            if (completed) {
              return;
            }

            completed = true;

            reject(
              new Error(
                `Socket event "${eventName}" timed out.`,
              ),
            );
          },
          SOCKET_RESPONSE_TIMEOUT,
        );

      const handleResponse = (
        response: Response,
      ) => {
        if (completed) {
          return;
        }

        completed = true;

        globalThis.clearTimeout(
          timeoutId,
        );

        resolve(response);
      };

      try {
        emitRequest(
          handleResponse,
        );
      } catch (error) {
        if (completed) {
          return;
        }

        completed = true;

        globalThis.clearTimeout(
          timeoutId,
        );

        reject(
          error instanceof Error
            ? error
            : new Error(
                "Unable to send the call socket event.",
              ),
        );
      }
    },
  );
}