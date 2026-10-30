"use client";
import {callRouteAllowed} from '@/features/auth/call-session-policy';
import {publicAuthBase,sessionCandidate,verifyNavigationSession} from "@/features/auth/public-auth";

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
  authenticated?: boolean;
  userId?: string;
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

  "auth:required": (payload:{code?:string})=>void;
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

let socket:CallSocket|null=null;
let registeredUserId='',boundToken='',generation=0;
let serverAuthenticated=false,serverRegistered=false,retryExhausted=false;
export type CallConnectionState='idle'|'connecting'|'retrying'|'ready'|'unavailable'|'unauthorized';
let connectionState:CallConnectionState='idle';
const statusListeners=new Set<(state:CallConnectionState)=>void>();
function publish(state:CallConnectionState){connectionState=state;for(const listener of statusListeners)listener(state);}
export function onCallConnectionState(listener:(state:CallConnectionState)=>void){statusListeners.add(listener);listener(connectionState);return()=>{statusListeners.delete(listener);};}
export function retryCallSocket(userId:string){disconnectCallSocket();return connectCallSocket(userId);}
function getBaseUrl(){return publicAuthBase((process.env.NEXT_PUBLIC_API_BASE_URL??process.env.NEXT_PUBLIC_API_URL)?.trim());}
function registerCurrentUser(){if(socket?.connected&&serverAuthenticated&&registeredUserId)socket.emit('call:register',{userId:registeredUserId});}
export function connectCallSocket(userId:string):CallSocket{
 const id=userId?.trim(),path=typeof window==='undefined'?'':window.location.pathname;
 if(!id)throw Error('User ID is required to connect the call socket.');
 const candidate=typeof window==='undefined'?null:sessionCandidate(path);
 if(!candidate||!callRouteAllowed(path))throw Error('LOGIN_REQUIRED');
 let descriptor;try{descriptor=JSON.parse(localStorage.getItem('asp_user')||'{}');}catch{throw Error('LOGIN_REQUIRED');}
 if(descriptor.id!==id)throw Error('Socket identity does not match the selected account.');
 if(socket&&(registeredUserId!==id||boundToken!==candidate.token))disconnectCallSocket();
 registeredUserId=id;boundToken=candidate.token;
 if(socket){if(socket.connected)registerCurrentUser();else if(!retryExhausted)socket.connect();return socket;}
 const version=++generation;let refreshUsed=false;
 const current=()=>version===generation&&socket===client;
 const client:CallSocket=io(getBaseUrl()+'/call',{path:'/socket.io',transports:['polling','websocket'],tryAllTransports:true,withCredentials:false,forceNew:true,autoConnect:false,auth:{token:candidate.token},reconnection:true,reconnectionAttempts:5,reconnectionDelay:1000,reconnectionDelayMax:10000,randomizationFactor:.3,timeout:8000});
 socket=client;publish('connecting');
 async function refreshAuthentication(){if(!current()||refreshUsed)return;refreshUsed=true;retryExhausted=true;publish('unauthorized');client.disconnect();try{const verified=await verifyNavigationSession(window.location.pathname,AbortSignal.timeout(20000));if(!current()||!verified||verified.id!==registeredUserId||!callRouteAllowed(window.location.pathname))return;const fresh=sessionCandidate(window.location.pathname);if(!fresh||fresh.portal!==verified.portal)return;boundToken=fresh.token;client.auth={token:boundToken};retryExhausted=false;publish('connecting');client.connect();}catch{if(current())publish('unauthorized');}}
 client.on('connect',()=>{if(!current())return;serverAuthenticated=false;serverRegistered=false;publish('connecting');});
 client.on('call:connected',payload=>{if(!current())return;if(payload.success!==true||payload.authenticated!==true||payload.userId!==registeredUserId){disconnectCallSocket();return;}serverAuthenticated=true;registerCurrentUser();});
 client.on('call:registered',payload=>{if(!current())return;if(!serverAuthenticated||payload.userId!==registeredUserId){disconnectCallSocket();return;}serverRegistered=true;retryExhausted=false;publish('ready');});
 client.on('disconnect',()=>{if(!current())return;serverAuthenticated=false;serverRegistered=false;if(!retryExhausted)publish('retrying');});
 client.on('connect_error',error=>{if(!current())return;serverAuthenticated=false;serverRegistered=false;publish('retrying');if(/authentication|unauthori[sz]ed|token expired|auth_required/i.test(error.message))void refreshAuthentication();});
 client.on('call:error',payload=>{if(!current())return;if(String(payload.code)==='AUTHENTICATION_FAILED')void refreshAuthentication();});
 client.on('auth:required',()=>{void refreshAuthentication();});
 client.io?.on?.('reconnect_attempt',()=>{if(!current())return;const next=sessionCandidate(window.location.pathname);let selected;try{selected=JSON.parse(localStorage.getItem('asp_user')||'{}');}catch{}if(!next||selected?.id!==registeredUserId||!callRouteAllowed(window.location.pathname)){disconnectCallSocket();return;}boundToken=next.token;client.auth={token:boundToken};publish('retrying');});
 client.io?.on?.('reconnect_failed',()=>{if(!current())return;retryExhausted=true;publish('unavailable');});
 client.connect();return client;
}

export function getCallSocket():
  CallSocket | null {
  return socket;
}

export function isCallSocketConnected():
  boolean {
  return Boolean(
    socket?.connected && serverRegistered,
  );
}

export function disconnectCallSocket():
  void {
  generation++;retryExhausted=false;publish('idle');boundToken="";serverAuthenticated=false;serverRegistered=false;
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
  if (!isCallSocketConnected()) {
    console.error(
      "[CALL] Cannot initiate: socket is not connected.",
    );

    return false;
  }

  socket!.emit(
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
  if (!isCallSocketConnected()) {
    console.error(
      "[CALL] Cannot accept: socket is not connected.",
    );

    return false;
  }

  socket!.emit(
    "call:accept",
    payload,
  );

  return true;
}

export function rejectCall(
  payload: RejectCallPayload,
): boolean {
  if (!isCallSocketConnected()) {
    console.error(
      "[CALL] Cannot reject: socket is not connected.",
    );

    return false;
  }

  socket!.emit(
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
  if (!isCallSocketConnected()) {
    console.error(
      "[CALL] Cannot cancel: socket is not connected.",
    );

    return false;
  }

  socket!.emit(
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