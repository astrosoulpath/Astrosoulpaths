import { Platform } from "react-native";
import {
  ZegoAudioConfig,
  ZegoAudioConfigPreset,
  ZegoEngineProfile,
  default as ZegoExpressEngine,
  ZegoPlayerState,
  ZegoPublisherState,
  ZegoRoomConfig,
  ZegoRoomStateChangedReason,
  ZegoStream,
  ZegoUpdateType,
  ZegoUser,
} from "zego-express-engine-reactnative";

import {
  buildStreamID,
  hasValidZegoConfig,
  ZEGO_APP_ID,
  ZEGO_APP_SIGN,
  ZEGO_SCENARIO,
} from "@/src/constants/zegoConfig";
import {
  RemoteAudioStream,
  RoomUserSummary,
  ZegoListenerCallbacks,
} from "@/src/types/zego";

function logZego(message: string, payload?: Record<string, unknown>) {
  if (payload) {
    console.log(`[ZEGO] ${message}`, payload);
    return;
  }

  console.log(`[ZEGO] ${message}`);
}

class ZegoService {
  private engine: ZegoExpressEngine | null = null;
  private enginePromise: Promise<ZegoExpressEngine> | null = null;
  private activeRoomID: string | null = null;
  private localStreamID: string | null = null;
  private remoteStreamIDs = new Set<string>();
  private leaveRoomPromise: Promise<void> | null = null;
  private listenerCallbacks = new Map<number, ZegoListenerCallbacks>();
  private nextListenerID = 1;
  private hasBoundEngineListeners = false;

  async initialize() {
    const engine = await this.getEngine();
    logZego("Engine initialized", {
      hasActiveRoom: Boolean(this.activeRoomID),
      localStreamID: this.localStreamID,
    });
    return engine;
  }

  async addListeners(callbacks: ZegoListenerCallbacks) {
    await this.getEngine();

    const listenerID = this.nextListenerID++;
    this.listenerCallbacks.set(listenerID, callbacks);

    logZego("Registered JS listener set", {
      listenerID,
      totalListeners: this.listenerCallbacks.size,
    });

    return () => {
      this.listenerCallbacks.delete(listenerID);
      logZego("Removed JS listener set", {
        listenerID,
        totalListeners: this.listenerCallbacks.size,
      });
    };
  }

  async joinRoom({ roomID, userID }: { roomID: string; userID: string }) {
    const engine = await this.getEngine();
    this.bindEngineListeners(engine);

    if (this.activeRoomID && this.activeRoomID !== roomID) {
      await this.leaveRoom();
    }

    await this.configureAudioEngine(engine);

    const user = new ZegoUser(userID, userID);
    const roomConfig = new ZegoRoomConfig(0, true, "");

    logZego("Calling loginRoom", {
      roomID,
      userID,
      registeredListenerSets: this.listenerCallbacks.size,
      isUserStatusNotify: roomConfig.isUserStatusNotify,
    });

    const loginResult = await engine.loginRoom(roomID, user, roomConfig);

    logZego("loginRoom resolved", {
      roomID,
      userID,
      loginResult,
    });

    const streamID = buildStreamID(roomID, userID);

    await engine.mutePublishStreamVideo(true, undefined);
    await engine.mutePublishStreamAudio(false, undefined);
    await engine.enableAudioCaptureDevice(true);
    await engine.setCaptureVolume(100);
    await engine.muteMicrophone(false);

    logZego("Calling startPublishingStream", {
      roomID,
      userID,
      streamID,
    });

    await engine.startPublishingStream(streamID, undefined, undefined);

    this.activeRoomID = roomID;
    this.localStreamID = streamID;

    logZego("Local publish started", {
      roomID,
      userID,
      streamID,
    });

    return streamID;
  }

  async startPlayingStream(streamID: string) {
    const engine = await this.getEngine();

    if (this.remoteStreamIDs.has(streamID)) {
      logZego("Skipping duplicate startPlayingStream", { streamID });
      return;
    }

    logZego("Calling startPlayingStream", { streamID });

    await engine.startPlayingStream(streamID, undefined, undefined);
    await engine.muteAllPlayStreamAudio(false);
    await engine.mutePlayStreamAudio(streamID, false);
    await engine.mutePlayStreamVideo(streamID, true);
    await engine.setPlayVolume(streamID, 100);
    await engine.muteSpeaker(false);
    await engine.setAudioRouteToSpeaker(true);
    this.remoteStreamIDs.add(streamID);

    logZego("Remote stream playback requested", { streamID });
  }

  async stopPlayingStream(streamID: string) {
    if (!this.engine || !this.remoteStreamIDs.has(streamID)) {
      return;
    }

    logZego("Stopping remote playback", { streamID });
    this.remoteStreamIDs.delete(streamID);
    await this.engine.stopPlayingStream(streamID);
  }

  async setMicrophoneMuted(muted: boolean) {
    const engine = await this.getEngine();

    logZego("Updating microphone mute state", { muted });
    await engine.muteMicrophone(muted);
  }

  async leaveRoom() {
    if (this.leaveRoomPromise) {
      return this.leaveRoomPromise;
    }

    const engine = this.engine;

    if (!engine) {
      this.activeRoomID = null;
      this.localStreamID = null;
      this.remoteStreamIDs.clear();
      return;
    }

    this.leaveRoomPromise = (async () => {
      logZego("leaveRoom begin", {
        activeRoomID: this.activeRoomID,
        localStreamID: this.localStreamID,
        remoteStreamIDs: Array.from(this.remoteStreamIDs),
      });

      for (const streamID of Array.from(this.remoteStreamIDs)) {
        try {
          await this.stopPlayingStream(streamID);
        } catch {
          // Ignore already-stopped remote playback during teardown.
        }
      }

      if (this.localStreamID) {
        try {
          logZego("leaveRoom stopping local publish", {
            streamID: this.localStreamID,
          });
          await engine.stopPublishingStream(undefined);
        } catch {
          // Ignore stale publish stop failures during teardown.
        }
      }

      if (this.activeRoomID) {
        try {
          logZego("leaveRoom calling logoutRoom", {
            roomID: this.activeRoomID,
          });
          await engine.logoutRoom(this.activeRoomID);
        } catch {
          // Ignore room logout failures during teardown.
        }
      }

      this.activeRoomID = null;
      this.localStreamID = null;
      this.remoteStreamIDs.clear();

      logZego("leaveRoom complete", {
        activeRoomID: this.activeRoomID,
        localStreamID: this.localStreamID,
        remoteStreamCount: this.remoteStreamIDs.size,
      });
    })().finally(() => {
      this.leaveRoomPromise = null;
    });

    return this.leaveRoomPromise;
  }

  async destroy() {
    const engine = this.engine;

    if (!engine) {
      return;
    }

    await this.leaveRoom();

    try {
      logZego("Destroying ZEGO engine");
      await ZegoExpressEngine.destroyEngine();
    } finally {
      this.engine = null;
      this.enginePromise = null;
      this.activeRoomID = null;
      this.localStreamID = null;
      this.remoteStreamIDs.clear();
      this.leaveRoomPromise = null;
      this.hasBoundEngineListeners = false;
    }
  }

  getLocalStreamID() {
    return this.localStreamID;
  }

  private async getEngine() {
    if (Platform.OS === "web") {
      throw new Error(
        "ZEGO audio calling is only available on Android and iOS dev builds.",
      );
    }

    if (!hasValidZegoConfig()) {
      throw new Error(
        "ZEGO AppID or AppSign is missing. Check app.json extra.zego.",
      );
    }

    if (this.engine) {
      return this.engine;
    }

    if (!this.enginePromise) {
      this.enginePromise = (async () => {
        const profile = new ZegoEngineProfile(
          ZEGO_APP_ID,
          ZEGO_APP_SIGN,
          ZEGO_SCENARIO,
        );
        const engine = await ZegoExpressEngine.createEngineWithProfile(profile);

        await this.configureAudioEngine(engine);
        this.bindEngineListeners(engine);

        this.engine = engine;
        return engine;
      })().catch((error) => {
        this.enginePromise = null;
        throw error;
      });
    }

    return this.enginePromise;
  }

  private async configureAudioEngine(engine: ZegoExpressEngine) {
    const audioConfig = new ZegoAudioConfig(
      ZegoAudioConfigPreset.StandardQuality,
    );

    await engine.enableCamera(false, undefined);
    await engine.setAudioConfig(audioConfig, undefined);
    await engine.enableAudioCaptureDevice(true);
    await engine.mutePublishStreamAudio(false, undefined);
    await engine.setCaptureVolume(100);
    await engine.muteAllPlayStreamAudio(false);
    await engine.muteSpeaker(false);
    await engine.setAudioRouteToSpeaker(true);
    await engine.enableAEC(true);
    await engine.enableAGC(true);
    await engine.enableANS(true);

    logZego("Audio engine configured", {
      speakerRoute: true,
      audioCaptureEnabled: true,
      allRemoteAudioMuted: false,
      publishAudioMuted: false,
      captureVolume: 100,
    });
  }

  private bindEngineListeners(engine: ZegoExpressEngine) {
    if (this.hasBoundEngineListeners) {
      return;
    }

    engine.on(
      "roomStateChanged",
      (
        roomID: string,
        reason: ZegoRoomStateChangedReason,
        errorCode: number,
      ) => {
        logZego("roomStateChanged", { roomID, reason, errorCode });
        this.emitToListeners((callbacks) => {
          callbacks.onRoomStateChanged?.(roomID, reason, errorCode);
        });
      },
    );

    engine.on(
      "roomUserUpdate",
      (roomID: string, updateType: ZegoUpdateType, userList: ZegoUser[]) => {
        const mappedUsers: RoomUserSummary[] = userList.map((user) => ({
          userID: user.userID,
          userName: user.userName,
        }));

        logZego("RoomUserUpdate", {
          roomID,
          updateType,
          users: mappedUsers,
        });

        this.emitToListeners((callbacks) => {
          callbacks.onRoomUserUpdate?.(roomID, updateType, mappedUsers);
        });
      },
    );

    engine.on(
      "roomStreamUpdate",
      (
        roomID: string,
        updateType: ZegoUpdateType,
        streamList: ZegoStream[],
      ) => {
        const mappedStreams: RemoteAudioStream[] = streamList.map((stream) => ({
          streamID: stream.streamID,
          userID: stream.user.userID,
          userName: stream.user.userName,
        }));

        logZego("RoomStreamUpdate", {
          roomID,
          updateType,
          streamIDs: mappedStreams.map((stream) => stream.streamID),
          users: mappedStreams.map((stream) => stream.userID),
        });

        this.emitToListeners((callbacks) => {
          callbacks.onRoomStreamUpdate?.(roomID, updateType, mappedStreams);
        });
      },
    );

    engine.on(
      "publisherStateUpdate",
      (streamID: string, state: ZegoPublisherState, errorCode: number) => {
        logZego("PublisherStateUpdate", {
          streamID,
          state,
          errorCode,
          isPublishing: state === ZegoPublisherState.Publishing,
        });
        this.emitToListeners((callbacks) => {
          callbacks.onPublisherStateUpdate?.(streamID, state, errorCode);
        });
      },
    );

    engine.on(
      "playerStateUpdate",
      (streamID: string, state: ZegoPlayerState, errorCode: number) => {
        logZego("PlayerStateUpdate", {
          streamID,
          state,
          errorCode,
          isPlaying: state === ZegoPlayerState.Playing,
        });
        this.emitToListeners((callbacks) => {
          callbacks.onPlayerStateUpdate?.(streamID, state, errorCode);
        });
      },
    );

    engine.on(
      "debugError",
      (errorCode: number, funcName: string, info: string) => {
        logZego("debugError", { errorCode, funcName, info });
        this.emitToListeners((callbacks) => {
          callbacks.onDebugError?.(errorCode, funcName, info);
        });
      },
    );

    this.hasBoundEngineListeners = true;
  }

  private emitToListeners(emit: (callbacks: ZegoListenerCallbacks) => void) {
    for (const callbacks of this.listenerCallbacks.values()) {
      emit(callbacks);
    }
  }
}

export const zegoService = new ZegoService();
