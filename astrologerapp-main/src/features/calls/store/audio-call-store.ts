import { create } from "zustand";

import type { IncomingCallInvite } from "@/src/services/zego-call-invite-service";

export type AudioCallStage =
  | "booting"
  | "waiting"
  | "incoming"
  | "connecting"
  | "reconnecting"
  | "in-call"
  | "error";

export type CallLog = {
  id: string;
  message: string;
};

export type ActiveCall = {
  callID: string;
  callerID: string;
  callerName: string;
  roomID: string;
  token?: string;
};

type AudioCallStoreState = {
  activeCall: ActiveCall | null;
  connectionState: string;
  errorMessage: string | null;
  incomingInvite: IncomingCallInvite | null;
  isMicMuted: boolean;
  isReady: boolean;
  logs: CallLog[];
  remoteParticipantCount: number;
  roomState: string;
  speakerEnabled: boolean;
  speakerRoute: string;
  stage: AudioCallStage;
};

type AudioCallStoreActions = {
  appendLog: (message: string) => void;
  clearActiveCall: () => void;
  clearError: () => void;
  clearIncomingInvite: () => void;
  resetForIdle: () => void;
  setActiveCall: (call: ActiveCall | null) => void;
  setConnectionState: (connectionState: string) => void;
  setErrorMessage: (errorMessage: string | null) => void;
  setIncomingInvite: (incomingInvite: IncomingCallInvite | null) => void;
  setMicMuted: (isMicMuted: boolean) => void;
  setReady: (isReady: boolean) => void;
  setRemoteParticipantCount: (remoteParticipantCount: number) => void;
  setRoomState: (roomState: string) => void;
  setSpeakerState: (speakerEnabled: boolean, speakerRoute: string) => void;
  setStage: (stage: AudioCallStage) => void;
};

const MAX_LOGS = 24;

function createLog(message: string): CallLog {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
  };
}

const initialState: AudioCallStoreState = {
  activeCall: null,
  connectionState: "Disconnected",
  errorMessage: null,
  incomingInvite: null,
  isMicMuted: false,
  isReady: false,
  logs: [],
  remoteParticipantCount: 0,
  roomState: "Disconnected",
  speakerEnabled: true,
  speakerRoute: "Speaker",
  stage: "booting",
};

export const useAudioCallStore = create<
  AudioCallStoreState & AudioCallStoreActions
>((set) => ({
  ...initialState,
  appendLog: (message) => {
    set((state) => ({
      logs: [createLog(message), ...state.logs].slice(0, MAX_LOGS),
    }));
  },
  clearActiveCall: () => {
    set({ activeCall: null });
  },
  clearError: () => {
    set({ errorMessage: null });
  },
  clearIncomingInvite: () => {
    set({ incomingInvite: null });
  },
  resetForIdle: () => {
    set((state) => ({
      activeCall: null,
      errorMessage: null,
      incomingInvite: null,
      isMicMuted: false,
      remoteParticipantCount: 0,
      roomState: "Disconnected",
      speakerEnabled: state.speakerEnabled,
      speakerRoute: state.speakerRoute,
      stage: state.isReady ? "waiting" : "booting",
    }));
  },
  setActiveCall: (activeCall) => {
    set({ activeCall });
  },
  setConnectionState: (connectionState) => {
    set({ connectionState });
  },
  setErrorMessage: (errorMessage) => {
    set({ errorMessage });
  },
  setIncomingInvite: (incomingInvite) => {
    set({ incomingInvite });
  },
  setMicMuted: (isMicMuted) => {
    set({ isMicMuted });
  },
  setReady: (isReady) => {
    set((state) => ({
      isReady,
      stage: isReady && state.stage === "booting" ? "waiting" : state.stage,
    }));
  },
  setRemoteParticipantCount: (remoteParticipantCount) => {
    set({ remoteParticipantCount });
  },
  setRoomState: (roomState) => {
    set({ roomState });
  },
  setSpeakerState: (speakerEnabled, speakerRoute) => {
    set({ speakerEnabled, speakerRoute });
  },
  setStage: (stage) => {
    set({ stage });
  },
}));