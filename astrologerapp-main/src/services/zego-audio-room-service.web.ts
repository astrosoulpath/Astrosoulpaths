import { getZegoConfig } from "@/src/features/calls/config/zego.config";
import { createLogger } from "@/src/lib/logger";

const logger = createLogger("ZegoAudioRoomServiceWeb");

const ZegoUpdateType = {
  Add: 0,
  Delete: 1,
} as const;

const ZegoPublisherState = {
  NoPublish: 0,
  PublishRequesting: 1,
  Publishing: 2,
} as const;

const ZegoPlayerState = {
  NoPlay: 0,
  PlayRequesting: 1,
  Playing: 2,
} as const;

const ZegoRoomStateChangedReason = {
  LoginFailed: 1,
  Logined: 2,
  Reconnecting: 3,
  Reconnected: 4,
  ReconnectFailed: 5,
  KickOut: 6,
  Logout: 7,
  LogoutFailed: 8,
} as const;

type ZegoWebUser = {
  userID: string;
  userName?: string;
};

type ZegoWebStream = {
  streamID: string;
  user: ZegoWebUser;
  extraInfo?: string;
};

type WebEngineEventHandler = (...args: any[]) => void;

type WebEngineCompat = {
  on: (
    eventName: string,
    handler: WebEngineEventHandler,
  ) => void;

  off?: (
    eventName: string,
    handler?: WebEngineEventHandler,
  ) => void;

  loginRoom: (
    roomID: string,
    token: string,
    user: {
      userID: string;
      userName: string;
    },
    config?: {
      userUpdate?: boolean;
    },
  ) => Promise<boolean>;

  logoutRoom: (roomID: string) => Promise<boolean>;

  createStream: (config?: unknown) => Promise<MediaStream>;

  destroyStream: (stream: MediaStream) => void;

  startPublishingStream: (
    streamID: string,
    stream: MediaStream,
    options?: unknown,
  ) => boolean;

  stopPublishingStream: (streamID: string) => boolean;

  startPlayingStream: (
    streamID: string,
    options?: unknown,
  ) => Promise<MediaStream>;

  stopPlayingStream: (streamID: string) => void;
};

export type AudioRoomSession = {
  roomID: string;
  streamID: string;
  token?: string;
  userID: string;
  userName: string;
};

export type AudioRoomListener = {
  onCapturedSoundLevelUpdate?: (soundLevel: number) => void;
  onLog?: (message: string) => void;
  onMicrophoneStateChange?: (muted: boolean) => void;

  onPlayerStateUpdate?: (
    streamID: string,
    state: number,
    errorCode: number,
    extendedData: string,
  ) => void;

  onPublisherStateUpdate?: (
    streamID: string,
    state: number,
    errorCode: number,
    extendedData: string,
  ) => void;

  onRemoteParticipantCountChange?: (count: number) => void;

  onRemoteSoundLevelUpdate?: (
    soundLevels: Record<string, number>,
  ) => void;

  onRoomStateChanged?: (
    roomID: string,
    reason: number,
    errorCode: number,
    extendedData: string,
  ) => void;

  onRoomStateChange?: (stateLabel: string) => void;

  onRoomStreamUpdate?: (
    roomID: string,
    updateType: number,
    streamList: ZegoWebStream[],
    remoteStreams: ZegoWebStream[],
    extendedData: string,
  ) => void;

  onSpeakerStateChange?: (
    speakerEnabled: boolean,
    routeLabel: string,
  ) => void;
};

class ZegoAudioRoomServiceWeb {
  private engine: WebEngineCompat | null = null;
  private listeners = new Set<AudioRoomListener>();

  private currentRoomID: string | null = null;
  private currentStreamID: string | null = null;
  private currentUserID: string | null = null;

  private localStream: MediaStream | null = null;

  private remoteStreams = new Map<string, ZegoWebStream>();
  private remoteMediaStreams = new Map<string, MediaStream>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();

  private microphoneMuted = false;
  private speakerEnabled = true;
  private registeredHandlers = false;
  private roomConnected = false;
  private localPublishing = false;
  private leavePromise: Promise<void> | null = null;

  subscribe(listener: AudioRoomListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async joinRoom(session: AudioRoomSession): Promise<void> {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined"
    ) {
      throw new Error(
        "ZEGO Web audio calling requires a browser environment.",
      );
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "This browser does not support microphone capture.",
      );
    }

    if (
      this.currentRoomID &&
      this.currentRoomID === session.roomID &&
      this.localPublishing
    ) {
      return;
    }

    await this.leaveRoom();

    const engine = await this.initialize();

    this.currentRoomID = session.roomID;
    this.currentStreamID = session.streamID;
    this.currentUserID = session.userID;

    this.emitRoomStateChange("Connecting");
    this.emitLog(`Joining ZEGO Web room ${session.roomID}`);

    const token = session.token?.trim() ?? "";

    const loggedIn = await engine.loginRoom(
      session.roomID,
      token,
      {
        userID: session.userID,
        userName: session.userName,
      },
      {
        userUpdate: true,
      },
    );

    if (!loggedIn) {
      this.resetRoomState();

      throw new Error(
        `Failed to login to ZEGO room ${session.roomID}.`,
      );
    }

    this.roomConnected = true;

    this.emitRoomStateChanged(
      session.roomID,
      ZegoRoomStateChangedReason.Logined,
      0,
      "",
    );

    this.emitRoomStateChange("Logined");
    this.emitLog(`Connected to ZEGO Web room ${session.roomID}`);

    try {
      this.localStream = await engine.createStream({
        camera: {
          audio: true,
          video: false,
        },
      });

      this.setLocalMicrophoneMuted(this.microphoneMuted);

      const publishRequested = engine.startPublishingStream(
        session.streamID,
        this.localStream,
      );

      if (!publishRequested) {
        throw new Error(
          `ZEGO rejected the publish request for ${session.streamID}.`,
        );
      }

      this.localPublishing = true;

      this.emitPublisherStateUpdate(
        session.streamID,
        ZegoPublisherState.Publishing,
        0,
        "",
      );

      this.emitLog(
        `Publishing local browser audio stream ${session.streamID}`,
      );

      this.emitSpeakerStateChange(
        this.speakerEnabled,
        "Browser default output",
      );
    } catch (error) {
      await this.leaveRoom();
      throw this.normalizeError(error);
    }
  }

  async leaveRoom(): Promise<void> {
    if (this.leavePromise) {
      return this.leavePromise;
    }

    this.leavePromise = this.performLeaveRoom().finally(() => {
      this.leavePromise = null;
    });

    return this.leavePromise;
  }

  async toggleMicrophone(): Promise<boolean> {
    if (!this.localStream) {
      throw new Error(
        "Microphone stream is not active. Join a call first.",
      );
    }

    this.microphoneMuted = !this.microphoneMuted;
    this.setLocalMicrophoneMuted(this.microphoneMuted);

    this.emitMicrophoneStateChange(this.microphoneMuted);

    return this.microphoneMuted;
  }

  async toggleSpeaker(): Promise<boolean> {
    this.speakerEnabled = !this.speakerEnabled;

    for (const audioElement of this.remoteAudioElements.values()) {
      audioElement.muted = !this.speakerEnabled;

      if (this.speakerEnabled) {
        await this.tryPlayAudio(audioElement);
      }
    }

    this.emitSpeakerStateChange(
      this.speakerEnabled,
      "Browser default output",
    );

    return this.speakerEnabled;
  }

  async handleAppStateChange(nextAppState: string): Promise<void> {
    this.emitLog(`Web app state changed to ${nextAppState}`);

    if (nextAppState !== "active") {
      return;
    }

    if (this.localStream) {
      this.setLocalMicrophoneMuted(this.microphoneMuted);
    }

    if (this.speakerEnabled) {
      for (const audioElement of this.remoteAudioElements.values()) {
        audioElement.muted = false;
        await this.tryPlayAudio(audioElement);
      }
    }
  }

  async cleanup(): Promise<void> {
    await this.leaveRoom();

    if (this.engine && this.registeredHandlers) {
      this.unregisterHandlers(this.engine);
    }

    this.engine = null;
    this.registeredHandlers = false;
  }

  getSpeakerEnabled(): boolean {
    return this.speakerEnabled;
  }

  private async initialize(): Promise<WebEngineCompat> {
  if (this.engine) {
    return this.engine;
  }

  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    throw new Error(
      "ZEGO Web engine cannot initialize during SSR.",
    );
  }

  const config = getZegoConfig();

  const { ZegoExpressEngine } = await import(
    "zego-express-engine-webrtc"
  );

  const engine = new ZegoExpressEngine(
    config.appID,
    config.server,
    {
      scenario: config.scenario,
    },
  ) as unknown as WebEngineCompat;

  this.engine = engine;
  this.registerHandlers(engine);
  this.registeredHandlers = true;

  this.emitLog("ZEGO Express Web engine initialized");

  return engine;
  }

  private registerHandlers(engine: WebEngineCompat): void {
    engine.on(
      "roomStreamUpdate",
      (
        roomID: string,
        updateType: number,
        streamList: ZegoWebStream[],
        extendedData = "",
      ) => {
        void this.handleRoomStreamUpdate(
          roomID,
          updateType,
          streamList ?? [],
          extendedData,
        );
      },
    );

    engine.on(
      "publisherStateUpdate",
      (
        streamID: string,
        state: number,
        errorCode: number,
        extendedData = "",
      ) => {
        if (streamID === this.currentStreamID) {
          this.localPublishing =
            state === ZegoPublisherState.Publishing;
        }

        this.emitPublisherStateUpdate(
          streamID,
          state,
          errorCode,
          extendedData,
        );

        this.emitLog(
          `Web publisher state ${state} for ${streamID}, error=${errorCode}`,
        );
      },
    );

    engine.on(
      "playerStateUpdate",
      (
        streamID: string,
        state: number,
        errorCode: number,
        extendedData = "",
      ) => {
        this.emitPlayerStateUpdate(
          streamID,
          state,
          errorCode,
          extendedData,
        );

        this.emitLog(
          `Web player state ${state} for ${streamID}, error=${errorCode}`,
        );
      },
    );

    engine.on(
      "roomStateChanged",
      (
        roomID: string,
        reason: number,
        errorCode: number,
        extendedData = "",
      ) => {
        this.roomConnected =
          reason === ZegoRoomStateChangedReason.Logined ||
          reason === ZegoRoomStateChangedReason.Reconnected;

        const stateLabel =
          this.getRoomStateLabel(reason);

        this.emitRoomStateChanged(
          roomID,
          reason,
          errorCode,
          extendedData,
        );

        this.emitRoomStateChange(stateLabel);
        this.emitLog(
          `Web room ${roomID} state: ${stateLabel}, error=${errorCode}`,
        );
      },
    );

    engine.on(
      "roomUserUpdate",
      (
        roomID: string,
        updateType: number,
        userList: ZegoWebUser[],
      ) => {
        logger.info("ZEGO Web room user update", {
          roomID,
          updateType,
          users: userList?.map((user) => user.userID) ?? [],
        });
      },
    );
  }

  private unregisterHandlers(engine: WebEngineCompat): void {
    if (!engine.off) {
      return;
    }

    const eventNames = [
      "roomStreamUpdate",
      "publisherStateUpdate",
      "playerStateUpdate",
      "roomStateChanged",
      "roomUserUpdate",
    ];

    for (const eventName of eventNames) {
      try {
        engine.off(eventName);
      } catch (error) {
        logger.warn(
          `Unable to remove ZEGO Web handler ${eventName}`,
          error,
        );
      }
    }
  }

  private async handleRoomStreamUpdate(
    roomID: string,
    updateType: number,
    streamList: ZegoWebStream[],
    extendedData: string,
  ): Promise<void> {
    if (
      this.currentRoomID &&
      roomID !== this.currentRoomID
    ) {
      return;
    }

    if (updateType === ZegoUpdateType.Add) {
      for (const stream of streamList) {
        if (
          stream.streamID === this.currentStreamID ||
          stream.user?.userID === this.currentUserID
        ) {
          continue;
        }

        this.remoteStreams.set(stream.streamID, stream);

        try {
          await this.startPlayingStream(stream.streamID);
        } catch (error) {
          logger.error(
            "Failed to play ZEGO Web remote stream",
            {
              error: this.normalizeError(error).message,
              streamID: stream.streamID,
            },
          );
        }
      }
    }

    if (updateType === ZegoUpdateType.Delete) {
      for (const stream of streamList) {
        this.remoteStreams.delete(stream.streamID);
        this.stopPlayingStream(stream.streamID);
      }
    }

    this.emitRemoteParticipantCountChange(
      this.remoteStreams.size,
    );

    this.emitRoomStreamUpdate(
      roomID,
      updateType,
      streamList,
      extendedData,
    );
  }

  private async startPlayingStream(
    streamID: string,
  ): Promise<void> {
    if (!this.engine) {
      throw new Error("ZEGO Web engine is not initialized.");
    }

    if (this.remoteAudioElements.has(streamID)) {
      return;
    }

    const mediaStream =
      await this.engine.startPlayingStream(streamID);

    this.remoteMediaStreams.set(streamID, mediaStream);

    const audioElement = document.createElement("audio");

    audioElement.autoplay = true;
    audioElement.controls = false;
    audioElement.muted = !this.speakerEnabled;
    audioElement.srcObject = mediaStream;

    audioElement.dataset.zegoStreamId = streamID;

    audioElement.style.position = "fixed";
    audioElement.style.width = "1px";
    audioElement.style.height = "1px";
    audioElement.style.opacity = "0";
    audioElement.style.pointerEvents = "none";

    document.body.appendChild(audioElement);

    this.remoteAudioElements.set(streamID, audioElement);

    await this.tryPlayAudio(audioElement);

    this.emitPlayerStateUpdate(
      streamID,
      ZegoPlayerState.Playing,
      0,
      "",
    );

    this.emitLog(
      `Playing remote browser audio stream ${streamID}`,
    );
  }

  private stopPlayingStream(streamID: string): void {
    if (this.engine) {
      try {
        this.engine.stopPlayingStream(streamID);
      } catch (error) {
        logger.warn(
          `Failed to stop ZEGO Web stream ${streamID}`,
          error,
        );
      }
    }

    const audioElement =
      this.remoteAudioElements.get(streamID);

    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.remove();

      this.remoteAudioElements.delete(streamID);
    }

    const mediaStream =
      this.remoteMediaStreams.get(streamID);

    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        track.stop();
      }

      this.remoteMediaStreams.delete(streamID);
    }

    this.emitPlayerStateUpdate(
      streamID,
      ZegoPlayerState.NoPlay,
      0,
      "",
    );
  }

  private async performLeaveRoom(): Promise<void> {
    const engine = this.engine;
    const roomID = this.currentRoomID;
    const streamID = this.currentStreamID;

    for (const remoteStreamID of [
      ...this.remoteAudioElements.keys(),
    ]) {
      this.stopPlayingStream(remoteStreamID);
    }

    if (engine && streamID) {
      try {
        engine.stopPublishingStream(streamID);
      } catch (error) {
        logger.warn(
          `Failed to stop Web publishing ${streamID}`,
          error,
        );
      }
    }

    if (engine && this.localStream) {
      try {
        engine.destroyStream(this.localStream);
      } catch (error) {
        logger.warn(
          "Failed to destroy ZEGO Web local stream",
          error,
        );
      }
    }

    this.localStream = null;

    if (engine && roomID) {
      try {
        await engine.logoutRoom(roomID);
      } catch (error) {
        logger.warn(
          `Failed to logout ZEGO Web room ${roomID}`,
          error,
        );
      }
    }

    this.resetRoomState();

    if (roomID) {
      this.emitRoomStateChanged(
        roomID,
        ZegoRoomStateChangedReason.Logout,
        0,
        "",
      );

      this.emitRoomStateChange("Logout");
      this.emitLog(`Left ZEGO Web room ${roomID}`);
    }
  }

  private setLocalMicrophoneMuted(muted: boolean): void {
    if (!this.localStream) {
      return;
    }

    for (const audioTrack of this.localStream.getAudioTracks()) {
      audioTrack.enabled = !muted;
    }
  }

  private async tryPlayAudio(
    audioElement: HTMLAudioElement,
  ): Promise<void> {
    try {
      await audioElement.play();
    } catch (error) {
      const message = this.normalizeError(error).message;

      this.emitLog(
        `Browser blocked automatic audio playback: ${message}. Tap the call screen once to enable sound.`,
      );

      logger.warn(
        "Browser autoplay prevented ZEGO remote audio",
        error,
      );
    }
  }

  private resetRoomState(): void {
    this.currentRoomID = null;
    this.currentStreamID = null;
    this.currentUserID = null;

    this.roomConnected = false;
    this.localPublishing = false;
    this.microphoneMuted = false;

    this.remoteStreams.clear();
    this.remoteMediaStreams.clear();
    this.remoteAudioElements.clear();

    this.emitMicrophoneStateChange(false);
    this.emitRemoteParticipantCountChange(0);
  }

  private getRoomStateLabel(reason: number): string {
    const labels: Record<number, string> = {
      [ZegoRoomStateChangedReason.LoginFailed]:
        "LoginFailed",
      [ZegoRoomStateChangedReason.Logined]: "Logined",
      [ZegoRoomStateChangedReason.Reconnecting]:
        "Reconnecting",
      [ZegoRoomStateChangedReason.Reconnected]:
        "Reconnected",
      [ZegoRoomStateChangedReason.ReconnectFailed]:
        "ReconnectFailed",
      [ZegoRoomStateChangedReason.KickOut]: "KickOut",
      [ZegoRoomStateChangedReason.Logout]: "Logout",
      [ZegoRoomStateChangedReason.LogoutFailed]:
        "LogoutFailed",
    };

    return labels[reason] ?? String(reason);
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error(String(error));
  }

  private emitLog(message: string): void {
    for (const listener of this.listeners) {
      listener.onLog?.(message);
    }
  }

  private emitMicrophoneStateChange(muted: boolean): void {
    for (const listener of this.listeners) {
      listener.onMicrophoneStateChange?.(muted);
    }

    this.emitLog(
      muted ? "Browser microphone muted" : "Browser microphone live",
    );
  }

  private emitPlayerStateUpdate(
    streamID: string,
    state: number,
    errorCode: number,
    extendedData: string,
  ): void {
    for (const listener of this.listeners) {
      listener.onPlayerStateUpdate?.(
        streamID,
        state,
        errorCode,
        extendedData,
      );
    }
  }

  private emitPublisherStateUpdate(
    streamID: string,
    state: number,
    errorCode: number,
    extendedData: string,
  ): void {
    for (const listener of this.listeners) {
      listener.onPublisherStateUpdate?.(
        streamID,
        state,
        errorCode,
        extendedData,
      );
    }
  }

  private emitRemoteParticipantCountChange(
    count: number,
  ): void {
    for (const listener of this.listeners) {
      listener.onRemoteParticipantCountChange?.(count);
    }
  }

  private emitRoomStateChanged(
    roomID: string,
    reason: number,
    errorCode: number,
    extendedData: string,
  ): void {
    for (const listener of this.listeners) {
      listener.onRoomStateChanged?.(
        roomID,
        reason,
        errorCode,
        extendedData,
      );
    }
  }

  private emitRoomStateChange(stateLabel: string): void {
    for (const listener of this.listeners) {
      listener.onRoomStateChange?.(stateLabel);
    }
  }

  private emitRoomStreamUpdate(
    roomID: string,
    updateType: number,
    streamList: ZegoWebStream[],
    extendedData: string,
  ): void {
    const allRemoteStreams = [
      ...this.remoteStreams.values(),
    ];

    for (const listener of this.listeners) {
      listener.onRoomStreamUpdate?.(
        roomID,
        updateType,
        streamList,
        allRemoteStreams,
        extendedData,
      );
    }
  }

  private emitSpeakerStateChange(
    enabled: boolean,
    routeLabel: string,
  ): void {
    for (const listener of this.listeners) {
      listener.onSpeakerStateChange?.(
        enabled,
        routeLabel,
      );
    }

    this.emitLog(
      enabled
        ? "Browser audio output enabled"
        : "Browser audio output muted",
    );
  }
}

export const zegoAudioRoomService =
  new ZegoAudioRoomServiceWeb();