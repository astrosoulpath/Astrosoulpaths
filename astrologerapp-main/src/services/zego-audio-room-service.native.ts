import ZegoExpressEngine, {
  ZegoAECMode,
  ZegoANSMode,
  ZegoAudioConfig,
  ZegoAudioConfigPreset,
  ZegoAudioRoute,
  ZegoEngineProfile,
  ZegoPlayerConfig,
  ZegoPlayerState,
  ZegoPublishChannel,
  ZegoPublisherConfig,
  ZegoPublisherState,
  ZegoRoomConfig,
  ZegoRoomStateChangedReason,
  ZegoScenario,
  ZegoSoundLevelConfig,
  ZegoStreamEvent,
  ZegoStream,
  ZegoUpdateType,
  ZegoUser,
} from "zego-express-engine-reactnative";

import { getZegoConfig } from "@/src/features/calls/config/zego.config";
import { createLogger } from "@/src/lib/logger";

const logger = createLogger("ZegoAudioRoomService");
const JOIN_TIMEOUT_MS = 15000;
const MAX_PLAYBACK_RETRIES = 3;
const ROOM_LEAVE_RETRY_DELAY_MS = 300;

type PendingTransition = {
  description: string;
  reject: (error: Error) => void;
  resolve: () => void;
  roomID?: string;
  sessionSerial: number;
  streamID?: string;
  timeoutHandle: ReturnType<typeof setTimeout>;
};

export type AudioRoomSession = {
  roomID: string;
  streamID: string;
  token?: string;
  userID: string;
  userName: string;
};

type AudioRoomListener = {
  onCapturedSoundLevelUpdate?: (soundLevel: number) => void;
  onLog?: (message: string) => void;
  onMicrophoneStateChange?: (muted: boolean) => void;
  onPlayerStateUpdate?: (
    streamID: string,
    state: ZegoPlayerState,
    errorCode: number,
    extendedData: string,
  ) => void;
  onPublisherStateUpdate?: (
    streamID: string,
    state: ZegoPublisherState,
    errorCode: number,
    extendedData: string,
  ) => void;
  onRemoteParticipantCountChange?: (count: number) => void;
  onRemoteSoundLevelUpdate?: (soundLevels: Record<string, number>) => void;
  onRoomStateChanged?: (
    roomID: string,
    reason: ZegoRoomStateChangedReason,
    errorCode: number,
    extendedData: string,
  ) => void;
  onRoomStateChange?: (stateLabel: string) => void;
  onRoomStreamUpdate?: (
    roomID: string,
    updateType: ZegoUpdateType,
    streamList: ZegoStream[],
    remoteStreams: ZegoStream[],
    extendedData: string,
  ) => void;
  onSpeakerStateChange?: (speakerEnabled: boolean, routeLabel: string) => void;
};

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

class ZegoAudioRoomService {
  private currentRoomID: string | null = null;
  private currentSessionSerial = 0;
  private currentStreamID: string | null = null;
  private currentUserID: string | null = null;
  private engine: ZegoExpressEngine | null = null;
  private engineReady = false;
  private isLeavingRoom = false;
  private leavePromise: Promise<void> | null = null;
  private listeners = new Set<AudioRoomListener>();
  private localPublishing = false;
  private microphoneMuted = false;
  private pendingTransition = false;
  private pendingPublishTransition: PendingTransition | null = null;
  private pendingRoomLoginTransition: PendingTransition | null = null;
  private playingStreamIDs = new Set<string>();
  private playbackRetryCounts = new Map<string, number>();
  private playbackRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private registeredHandlers = false;
  private remoteStreams = new Map<string, ZegoStream>();
  private roomConnected = false;
  private speakerEnabled = true;

  subscribe(listener: AudioRoomListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async joinRoom(session: AudioRoomSession) {
    const sessionSerial = ++this.currentSessionSerial;
    const engine = await this.initialize();

    if (!this.engineReady || !this.engine) {
      throw new Error("ZEGO engine is not initialized before loginRoom.");
    }

    if (this.leavePromise) {
      await this.leavePromise;
    }

    if (this.currentRoomID && this.currentRoomID !== session.roomID) {
      await this.leaveRoom();
    }

    this.isLeavingRoom = false;
    this.currentRoomID = session.roomID;
    this.currentStreamID = session.streamID;
    this.currentUserID = session.userID;
    this.roomConnected = false;
    this.localPublishing = false;
    this.clearPendingTransition("publish", "A new join request replaced the active publish wait.");
    this.clearPendingTransition("room", "A new join request replaced the active room-login wait.");
    this.clearPlaybackRetries();
    this.remoteStreams.clear();
    this.playingStreamIDs.clear();

    const roomConfig = new ZegoRoomConfig(0, true, session.token ?? "");
    const publisherConfig = new ZegoPublisherConfig(session.roomID);
    // ZEGO's RN bridge reads this optional field unconditionally when a config object is passed.
    // Set it explicitly to avoid a native HostFunction exception during startPublishingStream.
    publisherConfig.forceSynchronousNetworkTime = 0;
    const soundLevelConfig = new ZegoSoundLevelConfig(200, false);
    const user = new ZegoUser(session.userID, session.userName);
    const waitForRoomLogin = this.createPendingTransition({
      description: `room login for ${session.roomID}`,
      roomID: session.roomID,
      sessionSerial,
    });

    this.emitLog(`Joining ZEGO room ${session.roomID}`);
    logger.info("Joining ZEGO room", {
      callSession: sessionSerial,
      roomID: session.roomID,
      streamID: session.streamID,
      userID: session.userID,
    });

    await engine.enableAudioCaptureDevice(true);
    await engine.muteMicrophone(this.microphoneMuted);

    try {
      const roomLoginResult = await engine.loginRoom(session.roomID, user, roomConfig);

      logger.info("loginRoom resolved", {
        callSession: sessionSerial,
        roomID: session.roomID,
        roomLoginResult,
      });
      await waitForRoomLogin;
    } catch (error) {
      this.clearPendingTransition("room", "Room login ended before completion.");
      this.clearPendingTransition("publish", "Publish wait cancelled because room login failed.");
      throw error;
    }

    await engine.startSoundLevelMonitor(soundLevelConfig);
    this.emitLog(`Room ${session.roomID} connected. Starting local publish.`);

    // If a previous publish wait leaked, clear it before attaching the new one.
    this.clearPendingTransition(
      "publish",
      "A stale publish transition was cleared before starting a new publish.",
    );

    if (this.isLeavingRoom) {
      throw new Error("Room leave started");
    }

    const waitForPublish = this.createPendingTransition({
      description: `local publish for ${session.streamID}`,
      sessionSerial,
      streamID: session.streamID,
    });

    this.emitLog(
      `Starting local publish for ${session.streamID} in room ${session.roomID}.`,
    );
    logger.info("Calling startPublishingStream", {
      callSession: sessionSerial,
      channel: ZegoPublishChannel[ZegoPublishChannel.Main],
      forceSynchronousNetworkTime: publisherConfig.forceSynchronousNetworkTime,
      pendingPublish: this.describePendingPublishTransition(),
      publishRoomID: publisherConfig.roomID,
      roomID: session.roomID,
      streamID: session.streamID,
      userID: session.userID,
    });

    try {
      await engine.startPublishingStream(
        session.streamID,
        ZegoPublishChannel.Main,
        publisherConfig,
      );
      logger.info("startPublishingStream returned", {
        callSession: sessionSerial,
        pendingPublish: this.describePendingPublishTransition(),
        roomID: session.roomID,
        streamID: session.streamID,
      });
    } catch (error) {
      logger.error("startPublishingStream threw", {
        callSession: sessionSerial,
        error: error instanceof Error ? error.message : String(error),
        pendingPublish: this.describePendingPublishTransition(),
        roomID: session.roomID,
        streamID: session.streamID,
      });
      this.emitLog(
        `startPublishingStream threw before any publisher callback for ${session.streamID}.`,
      );
      throw error;
    }

    await waitForPublish;

    if (this.isLeavingRoom) {
      throw new Error("Room leave started");
    }

    await engine.mutePublishStreamVideo(true, ZegoPublishChannel.Main);
    await engine.mutePublishStreamAudio(false, ZegoPublishChannel.Main);
    await engine.muteSpeaker(false);
    await engine.setAudioRouteToSpeaker(this.speakerEnabled);

    const route = await engine.getAudioRouteType();

    this.emitSpeakerStateChange(this.speakerEnabled, ZegoAudioRoute[route]);
    await this.ensureRemotePlaybackConsistency("local publish ready", sessionSerial);
    this.emitLog(
      `Local stream ${session.streamID} is publishing. Waiting for remote streams in ${session.roomID}.`,
    );
    this.pendingTransition = false;
    logger.info("Joined ZEGO room", {
      callSession: sessionSerial,
      roomID: session.roomID,
      streamID: session.streamID,
      userID: session.userID,
    });
  }

  async leaveRoom() {
    if (this.isLeavingRoom && this.leavePromise) {
      return this.leavePromise;
    }

    if (!this.engine && !this.currentRoomID && this.playingStreamIDs.size === 0) {
      this.resetRoomState();
      return;
    }

    const roomID = this.currentRoomID;
    const streamID = this.currentStreamID;
    const leaveCallSite = this.captureCallSite();

    this.isLeavingRoom = true;
    this.pendingTransition = true;

    this.leavePromise = (async () => {
      logger.info("Leaving ZEGO room", {
        callSite: leaveCallSite,
        roomID,
        streamID,
      });
      this.emitLog(`leaveRoom() called for ${roomID ?? "no-room"} / ${streamID ?? "no-stream"}`);

      // During an intentional leave->join handoff we clear pending waits without rejecting
      // the new accept flow back up the stack.
      this.clearPendingTransition("room", "Room leave started.");
      this.clearPendingTransition("publish", "Room leave started.");
      this.clearPlaybackRetries();

      if (!this.engine) {
        return;
      }

      for (const playingStreamID of [...this.playingStreamIDs]) {
        await this.stopPlayingStream(playingStreamID);
      }

      await this.engine.stopSoundLevelMonitor();

      if (this.currentStreamID) {
        await this.engine.stopPublishingStream(ZegoPublishChannel.Main);
      }

      if (this.currentRoomID) {
        await this.engine.logoutRoom(this.currentRoomID);
      }
    })()
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("Room leave started")) {
          logger.warn("Ignoring overlapping ZEGO room leave request", {
            roomID,
            streamID,
          });
          this.emitLog("Room leave overlap detected; waiting for the current ZEGO leave to settle.");

          return wait(ROOM_LEAVE_RETRY_DELAY_MS);
        }

        logger.warn("ZEGO room leave failed", error);
        this.emitLog(
          `ZEGO room leave failed: ${message}`,
        );
      })
      .finally(() => {
        this.resetRoomState();
        this.isLeavingRoom = false;
        this.leavePromise = null;
        this.emitLog("Left ZEGO room");
      });

    return this.leavePromise;
  }

  async toggleMicrophone() {
    const engine = await this.ensureEngine();

    this.microphoneMuted = !this.microphoneMuted;
    await engine.muteMicrophone(this.microphoneMuted);
    this.emitMicrophoneStateChange(this.microphoneMuted);

    return this.microphoneMuted;
  }

  async toggleSpeaker() {
    const engine = await this.ensureEngine();

    this.speakerEnabled = !this.speakerEnabled;
    await engine.muteSpeaker(false);
    await engine.setAudioRouteToSpeaker(this.speakerEnabled);

    const route = await engine.getAudioRouteType();
    const routeLabel = ZegoAudioRoute[route];

    this.emitSpeakerStateChange(this.speakerEnabled, routeLabel);

    return this.speakerEnabled;
  }

  async cleanup() {
    await this.leaveRoom();
    this.clearPendingTransition("room", "Engine cleanup started.");
    this.clearPendingTransition("publish", "Engine cleanup started.");
    this.clearPlaybackRetries();

    if (this.engineReady) {
      await ZegoExpressEngine.destroyEngine();
    }

    this.engine = null;
    this.engineReady = false;
    this.registeredHandlers = false;
  }

  getSpeakerEnabled() {
    return this.speakerEnabled;
  }

  async handleAppStateChange(nextAppState: string) {
    if (!this.engineReady || !this.engine) {
      return;
    }

    if (nextAppState !== "active") {
      this.emitLog(`App state changed to ${nextAppState}`);
      return;
    }

    await this.engine.enableAudioCaptureDevice(true);
    await this.engine.muteMicrophone(this.microphoneMuted);
    await this.engine.muteSpeaker(false);
    await this.engine.setAudioRouteToSpeaker(this.speakerEnabled);

    const route = await this.engine.getAudioRouteType();

    this.emitSpeakerStateChange(this.speakerEnabled, ZegoAudioRoute[route]);
    await this.ensureRemotePlaybackConsistency(
      "app foreground recovery",
      this.currentSessionSerial,
    );
    this.emitLog("App returned to foreground and audio route was restored");
  }

  private async applyAudioDefaults(engine: ZegoExpressEngine) {
    const audioConfig = new ZegoAudioConfig(
      ZegoAudioConfigPreset.StandardQuality,
    );

    await engine.enableCamera(false, ZegoPublishChannel.Main);
    await engine.enableAudioCaptureDevice(true);
    await engine.enableAEC(true);
    await engine.setAECMode(ZegoAECMode.Aggressive);
    await engine.enableANS(true);
    await engine.setANSMode(ZegoANSMode.Medium);
    await engine.enableAGC(true);
    await engine.setAudioConfig(audioConfig, ZegoPublishChannel.Main);
    await engine.muteAllPlayStreamVideo(true);
    await engine.muteMicrophone(false);
    await engine.muteSpeaker(false);
    await engine.setAudioRouteToSpeaker(this.speakerEnabled);
  }

  private clearPendingTransition(
    type: "publish" | "room",
    reason: string,
  ) {
    const transition =
      type === "room"
        ? this.pendingRoomLoginTransition
        : this.pendingPublishTransition;

    if (!transition) {
      return;
    }

    const clearCallSite = this.captureCallSite();

    logger.debug("Clearing pending transition", {
      callSite: clearCallSite,
      pendingTransition: {
        description: transition.description,
        roomID: transition.roomID,
        sessionSerial: transition.sessionSerial,
        streamID: transition.streamID,
      },
      reason,
      type,
    });
    this.emitLog(
      `Clearing ${type} pending transition because: ${reason}`,
    );

    clearTimeout(transition.timeoutHandle);

    if (type === "room") {
      this.pendingRoomLoginTransition = null;
    } else {
      this.pendingPublishTransition = null;
    }

    if (this.pendingTransition) {
      logger.debug("Cleared pending transition during active room handoff", {
        reason,
        type,
      });
      transition.resolve();
      return;
    }

    transition.reject(new Error(reason));
  }

  private clearPlaybackRetries() {
    for (const retryTimer of this.playbackRetryTimers.values()) {
      clearTimeout(retryTimer);
    }

    this.playbackRetryCounts.clear();
    this.playbackRetryTimers.clear();
  }

  private createPendingTransition({
    description,
    roomID,
    sessionSerial,
    streamID,
  }: {
    description: string;
    roomID?: string;
    sessionSerial: number;
    streamID?: string;
  }) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };
      const transition: PendingTransition = {
        description,
        reject: (error) => {
          finish(() => reject(error));
        },
        resolve: () => {
          finish(() => resolve());
        },
        roomID,
        sessionSerial,
        streamID,
        timeoutHandle: setTimeout(() => {
          logger.warn("Pending ZEGO transition timed out", {
            currentRoomID: this.currentRoomID,
            currentStreamID: this.currentStreamID,
            description,
            roomConnected: this.roomConnected,
            roomID,
            sessionSerial,
            streamID,
          });
          this.emitLog(
            `ZEGO ${description} timed out while waiting for native callbacks.`,
          );
          finish(() => reject(new Error(`${description} timed out.`)));
        }, JOIN_TIMEOUT_MS),
      };

      logger.debug("Created pending ZEGO transition", {
        currentRoomID: this.currentRoomID,
        currentStreamID: this.currentStreamID,
        description,
        roomConnected: this.roomConnected,
        roomID,
        sessionSerial,
        streamID,
      });

      if (roomID) {
        this.pendingRoomLoginTransition = transition;
      } else {
        this.pendingPublishTransition = transition;
      }
    });
  }

  private emitLog(message: string) {
    for (const listener of this.listeners) {
      listener.onLog?.(message);
    }
  }

  private emitCapturedSoundLevelUpdate(soundLevel: number) {
    for (const listener of this.listeners) {
      listener.onCapturedSoundLevelUpdate?.(soundLevel);
    }
  }

  private emitMicrophoneStateChange(muted: boolean) {
    for (const listener of this.listeners) {
      listener.onMicrophoneStateChange?.(muted);
    }
    this.emitLog(muted ? "Microphone muted" : "Microphone live");
  }

  private emitPlayerStateUpdate(
    streamID: string,
    state: ZegoPlayerState,
    errorCode: number,
    extendedData: string,
  ) {
    for (const listener of this.listeners) {
      listener.onPlayerStateUpdate?.(streamID, state, errorCode, extendedData);
    }
  }

  private emitPublisherStateUpdate(
    streamID: string,
    state: ZegoPublisherState,
    errorCode: number,
    extendedData: string,
  ) {
    for (const listener of this.listeners) {
      listener.onPublisherStateUpdate?.(
        streamID,
        state,
        errorCode,
        extendedData,
      );
    }
  }

  private emitRemoteParticipantCountChange(count: number) {
    for (const listener of this.listeners) {
      listener.onRemoteParticipantCountChange?.(count);
    }
  }

  private emitRemoteSoundLevelUpdate(soundLevels: Record<string, number>) {
    for (const listener of this.listeners) {
      listener.onRemoteSoundLevelUpdate?.(soundLevels);
    }
  }

  private emitRoomStateChanged(
    roomID: string,
    reason: ZegoRoomStateChangedReason,
    errorCode: number,
    extendedData: string,
  ) {
    for (const listener of this.listeners) {
      listener.onRoomStateChanged?.(roomID, reason, errorCode, extendedData);
    }
  }

  private emitRoomStateChange(stateLabel: string) {
    for (const listener of this.listeners) {
      listener.onRoomStateChange?.(stateLabel);
    }
  }

  private emitRoomStreamUpdate(
    roomID: string,
    updateType: ZegoUpdateType,
    streamList: ZegoStream[],
    extendedData: string,
  ) {
    const remoteStreams = [...this.remoteStreams.values()];

    for (const listener of this.listeners) {
      listener.onRoomStreamUpdate?.(
        roomID,
        updateType,
        streamList,
        remoteStreams,
        extendedData,
      );
    }
  }

  private emitSpeakerStateChange(speakerEnabled: boolean, routeLabel: string) {
    for (const listener of this.listeners) {
      listener.onSpeakerStateChange?.(speakerEnabled, routeLabel);
    }
    this.emitLog(
      speakerEnabled
        ? `Speaker enabled via ${routeLabel}`
        : `Earpiece route active via ${routeLabel}`,
    );
  }

  private async ensureEngine() {
    return this.engine ?? this.initialize();
  }

  private async handleRoomStreamUpdate(
    roomID: string,
    updateType: ZegoUpdateType,
    streamList: ZegoStream[],
    extendedData: string,
  ) {
    if (this.currentRoomID && roomID !== this.currentRoomID) {
      logger.debug("Ignoring stream update for stale room", {
        currentRoomID: this.currentRoomID,
        roomID,
      });
      return;
    }

    if (updateType === ZegoUpdateType.Add) {
      for (const stream of streamList) {
        if (
          stream.streamID === this.currentStreamID ||
          stream.user.userID === this.currentUserID
        ) {
          logger.debug("Ignoring local stream in room update", {
            roomID,
            streamID: stream.streamID,
            userID: stream.user.userID,
          });
          continue;
        }

        this.remoteStreams.set(stream.streamID, stream);
        this.emitLog(
          `Remote stream added: ${stream.streamID} from ${stream.user.userID}. Starting playback.`,
        );
        await this.startPlayingStream(stream.streamID, "roomStreamUpdate:add");
      }
    }

    if (updateType === ZegoUpdateType.Delete) {
      for (const stream of streamList) {
        this.remoteStreams.delete(stream.streamID);
        this.cancelPlaybackRetry(stream.streamID);
        await this.stopPlayingStream(stream.streamID);
        this.emitLog(`Remote stream removed: ${stream.streamID}`);
      }
    }

    this.emitRemoteParticipantCountChange(this.remoteStreams.size);
    this.emitRoomStreamUpdate(roomID, updateType, streamList, extendedData);
  }

  private async initialize() {
    if (this.engineReady && this.engine) {
      return this.engine;
    }

    const config = getZegoConfig();
    const profile = new ZegoEngineProfile(
      config.appID,
      config.appSign,
      config.scenario ?? ZegoScenario.StandardVoiceCall,
    );

    this.engine = await ZegoExpressEngine.createEngineWithProfile(profile);
    this.engineReady = true;

    if (!this.registeredHandlers) {
      this.registerHandlers(this.engine);
      this.registeredHandlers = true;
    }

    await this.applyAudioDefaults(this.engine);

    logger.info("ZEGO Express engine initialized");

    return this.engine;
  }

  private registerHandlers(engine: ZegoExpressEngine) {
    engine.on("debugError", (errorCode, funcName, info) => {
      logger.error("ZEGO debug error", { errorCode, funcName, info });
      this.emitLog(
        `ZEGO error ${errorCode} from ${funcName}${info ? `: ${info}` : ""}`,
      );
    });

    engine.on("roomUserUpdate", (roomID, updateType, userList) => {
      logger.info("Room user update", {
        roomID,
        updateType: ZegoUpdateType[updateType],
        users: userList.map((user) => user.userID),
      });
      this.emitLog(
        `Room users ${ZegoUpdateType[updateType]}: ${userList.map((user) => user.userID).join(", ") || "none"}`,
      );
    });

    engine.on("roomOnlineUserCountUpdate", (roomID, count) => {
      logger.debug("Room online user count updated", { count, roomID });
    });

    engine.on("roomStateChanged", (roomID, reason, errorCode, extendedData) => {
      if (this.currentRoomID && roomID !== this.currentRoomID) {
        logger.debug("Ignoring room state change for stale room", {
          currentRoomID: this.currentRoomID,
          roomID,
        });
        return;
      }

      if (
        reason === ZegoRoomStateChangedReason.Logined ||
        reason === ZegoRoomStateChangedReason.Reconnected
      ) {
        this.roomConnected = true;
        this.resolvePendingRoomLogin(roomID);
        void this.ensureRemotePlaybackConsistency(
          reason === ZegoRoomStateChangedReason.Logined
            ? "room connected"
            : "room reconnected",
          this.currentSessionSerial,
        );
      }

      if (reason === ZegoRoomStateChangedReason.Reconnecting) {
        this.roomConnected = false;
        this.emitLog(`Room ${roomID} is reconnecting.`);
      }

      if (
        reason === ZegoRoomStateChangedReason.LoginFailed ||
        reason === ZegoRoomStateChangedReason.ReconnectFailed
      ) {
        this.roomConnected = false;
        this.rejectPendingRoomLogin(
          roomID,
          new Error(`Room ${roomID} failed with ZEGO code ${errorCode}.`),
        );
      }

      if (reason === ZegoRoomStateChangedReason.Logout) {
        this.roomConnected = false;
      }

      const stateLabel = ZegoRoomStateChangedReason[reason] ?? String(reason);
      this.emitRoomStateChanged(roomID, reason, errorCode, extendedData);
      this.emitRoomStateChange(stateLabel);
      this.emitLog(`Room ${roomID} state: ${stateLabel}`);
      logger.info("Room state changed", {
        errorCode,
        reason: stateLabel,
        roomID,
      });
    });

    engine.on("roomStreamUpdate", (roomID, updateType, streamList, extendedData) => {
      logger.info("Room stream update", {
        roomID,
        streamCount: streamList.length,
        updateType: ZegoUpdateType[updateType],
      });
      void this.handleRoomStreamUpdate(
        roomID,
        updateType,
        streamList,
        extendedData,
      );
    });

    engine.on(
      "publisherStateUpdate",
      (streamID, state, errorCode, extendedData) => {
        const stateLabel = ZegoPublisherState[state] ?? String(state);

        if (streamID === this.currentStreamID) {
          this.localPublishing = state === ZegoPublisherState.Publishing;
        }

        if (
          streamID === this.currentStreamID &&
          state === ZegoPublisherState.Publishing
        ) {
          this.resolvePendingPublish(streamID);
          this.emitLog(`Local publish active for ${streamID}`);
        }

        if (streamID === this.currentStreamID && errorCode !== 0) {
          this.localPublishing = false;
          this.rejectPendingPublish(
            streamID,
            new Error(`Local publish failed with ZEGO code ${errorCode}.`),
          );
        }

        this.emitLog(
          `Publisher state for ${streamID}: ${stateLabel} (error=${errorCode}, pending=${this.pendingPublishTransition?.streamID === streamID ? "yes" : "no"})${extendedData ? `, data=${extendedData}` : ""}`,
        );
        this.emitPublisherStateUpdate(streamID, state, errorCode, extendedData);
        logger.info("Publisher state changed", {
          errorCode,
          extendedData,
          isCurrentStream: streamID === this.currentStreamID,
          pendingPublish: this.describePendingPublishTransition(),
          roomConnected: this.roomConnected,
          state: stateLabel,
          streamID,
        });
      },
    );

    engine.on("publisherCapturedAudioFirstFrame", () => {
      this.emitLog(
        `Captured first local audio frame for ${this.currentStreamID ?? "unknown-stream"}.`,
      );
      logger.info("Publisher captured first audio frame", {
        currentStreamID: this.currentStreamID,
        pendingPublish: this.describePendingPublishTransition(),
        roomConnected: this.roomConnected,
      });
    });

    engine.on("publisherQualityUpdate", (streamID, quality) => {
  logger.debug("Publisher quality update", {
    streamID,
    level: quality.level,
    packetLostRate: quality.packetLostRate,
    rtt: quality.rtt,
    quality,
   });
  });

    engine.on("publisherStreamEvent", (eventID, streamID, extraInfo) => {
      const eventLabel = ZegoStreamEvent[eventID] ?? String(eventID);

      this.emitLog(
        `Publisher stream event for ${streamID}: ${eventLabel}${extraInfo ? `, data=${extraInfo}` : ""}`,
      );
      logger.info("Publisher stream event", {
        eventID,
        eventLabel,
        extraInfo,
        pendingPublish: this.describePendingPublishTransition(),
        streamID,
      });
    });

    engine.on("playerStateUpdate", (streamID, state, errorCode, extendedData) => {
      if (state === ZegoPlayerState.Playing) {
        this.playbackRetryCounts.delete(streamID);
        this.cancelPlaybackRetry(streamID);
        this.emitLog(`Remote playback active for ${streamID}`);
      }

      if (errorCode !== 0) {
        this.playingStreamIDs.delete(streamID);
        this.emitLog(`Remote playback failed for ${streamID} with ZEGO code ${errorCode}`);
        this.schedulePlaybackRetry(streamID, errorCode);
      }

      this.emitPlayerStateUpdate(streamID, state, errorCode, extendedData);
      logger.info("Player state changed", {
        errorCode,
        state: ZegoPlayerState[state],
        streamID,
      });
    });

    engine.on("playerRecvAudioFirstFrame", (streamID) => {
      this.emitLog(`Received first remote audio frame from ${streamID}`);
      logger.info("Player received first remote audio frame", { streamID });
    });

    engine.on("playerQualityUpdate", (streamID, quality) => {
      logger.debug("Player quality update", {
        level: quality.level,
        packetLostRate: quality.packetLostRate,
        rtt: quality.rtt,
        streamID,
      });
    });

    engine.on("playerMediaEvent", (streamID, event) => {
      logger.warn("Player media event", { event, streamID });
    });

    engine.on("capturedSoundLevelUpdate", (soundLevel) => {
      this.emitCapturedSoundLevelUpdate(soundLevel);
    });

    engine.on("remoteSoundLevelUpdate", (soundLevels) => {
      this.emitRemoteSoundLevelUpdate(soundLevels);
      logger.debug("Remote sound level update", { soundLevels });
    });

    engine.on("networkModeChanged", (mode) => {
      logger.info("Network mode changed", { mode });
    });

    engine.on("roomTokenWillExpire", (roomID, remainTimeInSecond) => {
      logger.warn("Room token will expire", { remainTimeInSecond, roomID });
      this.emitLog(
        `Room token for ${roomID} expires in ${remainTimeInSecond}s. Renew it before reconnect fails.`,
      );
    });
  }

  private resetRoomState() {
    this.currentRoomID = null;
    this.currentStreamID = null;
    this.currentUserID = null;
    this.roomConnected = false;
    this.localPublishing = false;
    this.microphoneMuted = false;
    this.clearPendingTransition("room", "Room state reset.");
    this.clearPendingTransition("publish", "Room state reset.");
    this.clearPlaybackRetries();
    this.remoteStreams.clear();
    this.playingStreamIDs.clear();
    this.emitMicrophoneStateChange(false);
    this.emitRemoteParticipantCountChange(0);
  }

  private async startPlayingStream(streamID: string, source: string) {
    const engine = await this.ensureEngine();

    if (this.playingStreamIDs.has(streamID)) {
      logger.debug("Skipping duplicate startPlayingStream request", {
        source,
        streamID,
      });
      return;
    }

    const playerConfig = new ZegoPlayerConfig();

    this.playingStreamIDs.add(streamID);

    try {
      await engine.muteSpeaker(false);
      await engine.setAudioRouteToSpeaker(this.speakerEnabled);
      await engine.startPlayingStream(streamID, undefined, playerConfig);
      await engine.mutePlayStreamVideo(streamID, true);
      await engine.mutePlayStreamAudio(streamID, false);
      await engine.setPlayVolume(streamID, 100);
      this.emitLog(`Requested playback for remote audio stream ${streamID}`);
      logger.info("startPlayingStream requested", { source, streamID });
    } catch (error) {
      this.playingStreamIDs.delete(streamID);
      logger.error("startPlayingStream failed", {
        error,
        source,
        streamID,
      });
      this.emitLog(
        `Failed to start playback for ${streamID}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.schedulePlaybackRetry(streamID);
    }
  }

  private async stopPlayingStream(streamID: string) {
    if (!this.engine || !this.playingStreamIDs.has(streamID)) {
      return;
    }

    try {
      await this.engine.stopPlayingStream(streamID);
      this.emitLog(`Stopped remote audio stream ${streamID}`);
    } finally {
      this.playingStreamIDs.delete(streamID);
    }
  }

  private cancelPlaybackRetry(streamID: string) {
    const retryTimer = this.playbackRetryTimers.get(streamID);

    if (retryTimer) {
      clearTimeout(retryTimer);
      this.playbackRetryTimers.delete(streamID);
    }
  }

  private async ensureRemotePlaybackConsistency(
    source: string,
    sessionSerial: number,
  ) {
    if (
      !this.roomConnected ||
      sessionSerial !== this.currentSessionSerial ||
      !this.currentRoomID
    ) {
      return;
    }

    for (const streamID of this.remoteStreams.keys()) {
      if (!this.playingStreamIDs.has(streamID)) {
        await this.startPlayingStream(streamID, source);
      }
    }
  }

  private rejectPendingPublish(streamID: string, error: Error) {
    const transition = this.pendingPublishTransition;

    if (!transition || transition.streamID !== streamID) {
      return;
    }

    logger.warn("Rejecting pending publish transition", {
      error: error.message,
      pendingPublish: this.describePendingPublishTransition(),
      roomConnected: this.roomConnected,
      streamID,
    });
    this.emitLog(`Pending publish failed for ${streamID}: ${error.message}`);
    clearTimeout(transition.timeoutHandle);
    this.pendingPublishTransition = null;
    transition.reject(error);
  }

  private rejectPendingRoomLogin(roomID: string, error: Error) {
    const transition = this.pendingRoomLoginTransition;

    if (!transition || transition.roomID !== roomID) {
      return;
    }

    clearTimeout(transition.timeoutHandle);
    this.pendingRoomLoginTransition = null;
    transition.reject(error);
  }

  private resolvePendingPublish(streamID: string) {
    const transition = this.pendingPublishTransition;

    if (!transition || transition.streamID !== streamID) {
      return;
    }

    logger.info("Resolving pending publish transition", {
      pendingPublish: this.describePendingPublishTransition(),
      roomConnected: this.roomConnected,
      streamID,
    });
    clearTimeout(transition.timeoutHandle);
    this.pendingPublishTransition = null;
    transition.resolve();
  }

  private describePendingPublishTransition() {
    const transition = this.pendingPublishTransition;

    if (!transition) {
      return null;
    }

    return {
      description: transition.description,
      roomID: transition.roomID,
      sessionSerial: transition.sessionSerial,
      streamID: transition.streamID,
    };
  }

  private captureCallSite() {
    const stack = new Error().stack;

    if (!stack) {
      return "stack unavailable";
    }

    return stack
      .split("\n")
      .slice(2, 7)
      .map((line) => line.trim())
      .join(" | ");
  }

  private resolvePendingRoomLogin(roomID: string) {
    const transition = this.pendingRoomLoginTransition;

    if (!transition || transition.roomID !== roomID) {
      return;
    }

    clearTimeout(transition.timeoutHandle);
    this.pendingRoomLoginTransition = null;
    transition.resolve();
  }

  private schedulePlaybackRetry(streamID: string, errorCode?: number) {
    if (!this.remoteStreams.has(streamID) || !this.roomConnected) {
      return;
    }

    const attempt = (this.playbackRetryCounts.get(streamID) ?? 0) + 1;

    if (attempt > MAX_PLAYBACK_RETRIES) {
      this.emitLog(`Playback retries exhausted for ${streamID}`);
      logger.warn("Playback retries exhausted", { errorCode, streamID });
      return;
    }

    this.playbackRetryCounts.set(streamID, attempt);
    this.cancelPlaybackRetry(streamID);

    const retryDelayMs = attempt * 750;
    const retryTimer = setTimeout(() => {
      this.playbackRetryTimers.delete(streamID);
      void this.startPlayingStream(streamID, `retry-${attempt}`);
    }, retryDelayMs);

    this.playbackRetryTimers.set(streamID, retryTimer);
    this.emitLog(
      `Retrying playback for ${streamID} in ${retryDelayMs}ms (attempt ${attempt}/${MAX_PLAYBACK_RETRIES})`,
    );
  }
}

export const zegoAudioRoomService = new ZegoAudioRoomService();
