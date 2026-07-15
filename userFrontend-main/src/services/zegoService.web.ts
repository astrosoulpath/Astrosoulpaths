import type {
  ZegoListenerCallbacks,
} from "@/src/types/zego";

const WEB_UNAVAILABLE_MESSAGE =
  "ZEGO audio calling is only available in the Android and iOS app.";

class ZegoServiceWeb {
  async initialize(): Promise<null> {
    return null;
  }

  async addListeners(
    _callbacks: ZegoListenerCallbacks,
  ): Promise<() => void> {
    return () => {};
  }

  async joinRoom(_options: {
    roomID: string;
    userID: string;
  }): Promise<string> {
    throw new Error(WEB_UNAVAILABLE_MESSAGE);
  }

  async startPlayingStream(
    _streamID: string,
  ): Promise<void> {
    throw new Error(WEB_UNAVAILABLE_MESSAGE);
  }

  async stopPlayingStream(
    _streamID: string,
  ): Promise<void> {
    return;
  }

  async setMicrophoneMuted(
    _muted: boolean,
  ): Promise<void> {
    return;
  }

  async leaveRoom(): Promise<void> {
    return;
  }

  async destroy(): Promise<void> {
    return;
  }

  getLocalStreamID(): null {
    return null;
  }
}

export const zegoService =
  new ZegoServiceWeb();