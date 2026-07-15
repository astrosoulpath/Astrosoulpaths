import {
  DEFAULT_STATUS,
  useAudioCallStore,
} from "@/src/store/audioCallStore";

const WEB_UNAVAILABLE_MESSAGE =
  "Audio calling is available only in the Android and iOS apps.";

class AudioCallControllerWeb {
  async initialize(): Promise<boolean> {
    useAudioCallStore.getState().patch({
      phase: "idle",
      error: null,
      statusMessage: DEFAULT_STATUS,
    });

    return true;
  }

  async startCall(): Promise<void> {
    useAudioCallStore.getState().patch({
      phase: "error",
      error: WEB_UNAVAILABLE_MESSAGE,
      statusMessage: WEB_UNAVAILABLE_MESSAGE,
    });
  }

  async endCall(): Promise<void> {
    useAudioCallStore.getState().resetSession();

    useAudioCallStore.getState().patch({
      phase: "idle",
      error: null,
      statusMessage: DEFAULT_STATUS,
    });
  }

  async toggleMicrophone(): Promise<void> {
    useAudioCallStore.getState().patch({
      error: WEB_UNAVAILABLE_MESSAGE,
      statusMessage: WEB_UNAVAILABLE_MESSAGE,
    });
  }
}

export const audioCallController =
  new AudioCallControllerWeb();