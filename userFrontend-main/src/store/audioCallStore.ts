import { create } from "zustand";

import {
  AudioCallPhase,
  AudioConnectionState,
  CallInvitationState,
  RemoteAudioStream,
} from "@/src/types/zego";

export const DEFAULT_STATUS =
  "Tap Call Astrologer to start the user-side audio flow.";
export const DEFAULT_RTC_STATE: AudioConnectionState = "disconnected";
export const DEFAULT_ZIM_STATE: AudioConnectionState = "disconnected";

export type AudioCallStoreSnapshot = {
  phase: AudioCallPhase;
  rtcConnectionState: AudioConnectionState;
  zimConnectionState: AudioConnectionState;
  invitationState: CallInvitationState;
  error: string | null;
  statusMessage: string;
  activeRoomID: string | null;
  localStreamID: string | null;
  currentCallID: string | null;
  remoteStreams: RemoteAudioStream[];
  isMicMuted: boolean;
  isAstrologerAccepted: boolean;
};

type AudioCallStoreState = AudioCallStoreSnapshot & {
  patch: (payload: Partial<AudioCallStoreSnapshot>) => void;
  upsertRemoteStream: (stream: RemoteAudioStream) => void;
  removeRemoteStreams: (streamIDs: string[]) => void;
  resetSession: () => void;
};

const initialState: AudioCallStoreSnapshot = {
  phase: "idle",
  rtcConnectionState: DEFAULT_RTC_STATE,
  zimConnectionState: DEFAULT_ZIM_STATE,
  invitationState: "idle",
  error: null,
  statusMessage: DEFAULT_STATUS,
  activeRoomID: null,
  localStreamID: null,
  currentCallID: null,
  remoteStreams: [],
  isMicMuted: false,
  isAstrologerAccepted: false,
};

export const useAudioCallStore = create<AudioCallStoreState>()((set) => ({
  ...initialState,
  patch: (payload) => {
    set(payload);
  },
  upsertRemoteStream: (stream) => {
    set((state) => {
      if (
        state.remoteStreams.some(
          (currentStream) => currentStream.streamID === stream.streamID,
        )
      ) {
        return state;
      }

      return {
        remoteStreams: [...state.remoteStreams, stream],
      };
    });
  },
  removeRemoteStreams: (streamIDs) => {
    set((state) => ({
      remoteStreams: state.remoteStreams.filter(
        (stream) => !streamIDs.includes(stream.streamID),
      ),
    }));
  },
  resetSession: () => {
    set((state) => ({
      ...state,
      phase: "idle",
      rtcConnectionState: DEFAULT_RTC_STATE,
      invitationState: "idle",
      error: null,
      statusMessage: DEFAULT_STATUS,
      activeRoomID: null,
      localStreamID: null,
      currentCallID: null,
      remoteStreams: [],
      isMicMuted: false,
      isAstrologerAccepted: false,
    }));
  },
}));
