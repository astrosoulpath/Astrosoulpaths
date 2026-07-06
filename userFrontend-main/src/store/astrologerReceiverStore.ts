import { create } from "zustand";

import { AudioConnectionState, RemoteAudioStream } from "@/src/types/zego";

export type AstrologerReceiverPhase =
  | "idle"
  | "listening"
  | "incoming-invite"
  | "accepting"
  | "joining-room"
  | "in-call"
  | "ending"
  | "error";

export const RECEIVER_DEFAULT_STATUS =
  "Waiting for user-side incoming ZEGO/ZIM audio calls.";

export type AstrologerReceiverSnapshot = {
  phase: AstrologerReceiverPhase;
  rtcConnectionState: AudioConnectionState;
  zimConnectionState: AudioConnectionState;
  statusMessage: string;
  error: string | null;
  activeRoomID: string | null;
  localStreamID: string | null;
  currentCallID: string | null;
  callerID: string | null;
  remoteStreams: RemoteAudioStream[];
  isMicMuted: boolean;
};

type AstrologerReceiverStoreState = AstrologerReceiverSnapshot & {
  patch: (payload: Partial<AstrologerReceiverSnapshot>) => void;
  upsertRemoteStream: (stream: RemoteAudioStream) => void;
  removeRemoteStreams: (streamIDs: string[]) => void;
  resetSession: () => void;
};

const initialState: AstrologerReceiverSnapshot = {
  phase: "idle",
  rtcConnectionState: "disconnected",
  zimConnectionState: "disconnected",
  statusMessage: RECEIVER_DEFAULT_STATUS,
  error: null,
  activeRoomID: null,
  localStreamID: null,
  currentCallID: null,
  callerID: null,
  remoteStreams: [],
  isMicMuted: false,
};

export const useAstrologerReceiverStore = create<AstrologerReceiverStoreState>()(
  (set) => ({
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
        phase: "listening",
        rtcConnectionState: "disconnected",
        statusMessage: RECEIVER_DEFAULT_STATUS,
        error: null,
        activeRoomID: null,
        localStreamID: null,
        currentCallID: null,
        callerID: null,
        remoteStreams: [],
        isMicMuted: false,
      }));
    },
  }),
);