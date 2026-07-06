export type AudioCallPhase =
  | "initializing"
  | "idle"
  | "requesting-permission"
  | "joining-room"
  | "inviting-astrologer"
  | "waiting-acceptance"
  | "in-call"
  | "ending"
  | "error";

export type AudioConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type CallInvitationState =
  | "idle"
  | "sending"
  | "waiting"
  | "accepted"
  | "rejected"
  | "timed-out"
  | "ended"
  | "cancelled";

export type AstrologerProfile = {
  userID: string;
  name: string;
  specialty: string;
  experience: string;
  languages: string;
  rating: string;
  about: string;
};

export type RemoteAudioStream = {
  streamID: string;
  userID: string;
  userName: string;
};

export type RoomUserSummary = {
  userID: string;
  userName: string;
};

export type IncomingCallInvitation = {
  callID: string;
  callerID: string;
  inviterID: string;
  roomID: string | null;
  extendedData: string;
  timeout: number;
};

export type ZegoListenerCallbacks = {
  onRoomStateChanged?: (
    roomID: string,
    reason: number,
    errorCode: number,
  ) => void;
  onRoomUserUpdate?: (
    roomID: string,
    updateType: number,
    users: RoomUserSummary[],
  ) => void;
  onRoomStreamUpdate?: (
    roomID: string,
    updateType: number,
    streams: RemoteAudioStream[],
  ) => void;
  onPublisherStateUpdate?: (
    streamID: string,
    state: number,
    errorCode: number,
  ) => void;
  onPlayerStateUpdate?: (
    streamID: string,
    state: number,
    errorCode: number,
  ) => void;
  onDebugError?: (errorCode: number, funcName: string, info: string) => void;
};

export type ZimCallUser = {
  userID: string;
  state: number;
};

export type ZimListenerCallbacks = {
  onConnectionStateChanged?: (
    state: number,
    event: number,
    extendedData: string,
  ) => void;
  onCallInvitationReceived?: (invitation: IncomingCallInvitation) => void;
  onCallInvitationCreated?: (callID: string) => void;
  onCallUserStateChanged?: (callID: string, users: ZimCallUser[]) => void;
  onCallInvitationTimeout?: (callID: string) => void;
  onCallInvitationEnded?: (callID: string, extendedData: string) => void;
  onError?: (code: number, message: string) => void;
};

