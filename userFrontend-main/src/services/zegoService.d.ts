import type {
  ZegoListenerCallbacks,
} from "@/src/types/zego";

export declare const zegoService: {
  initialize(): Promise<unknown>;

  addListeners(
    callbacks: ZegoListenerCallbacks,
  ): Promise<() => void>;

  joinRoom(options: {
    roomID: string;
    userID: string;
  }): Promise<string>;

  startPlayingStream(
    streamID: string,
  ): Promise<void>;

  stopPlayingStream(
    streamID: string,
  ): Promise<void>;

  setMicrophoneMuted(
    muted: boolean,
  ): Promise<void>;

  leaveRoom(): Promise<void>;

  destroy(): Promise<void>;

  getLocalStreamID():
    | string
    | null;
};