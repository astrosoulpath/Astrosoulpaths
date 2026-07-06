import {
  ZegoPlayerState,
  ZegoPublisherState,
  ZegoRoomStateChangedReason,
  ZegoUpdateType,
} from "zego-express-engine-reactnative";

import { ASTROLOGER_ID, USER_ID } from "@/src/constants/astrologyCall";
import { buildRoomID, buildStreamID } from "@/src/constants/zegoConfig";
import { zegoService } from "@/src/services/zegoService";
import {
  ZIMCallUserState,
  ZIMConnectionState,
  zimService,
} from "@/src/services/zimService";
import { DEFAULT_STATUS, useAudioCallStore } from "@/src/store/audioCallStore";
import { ZimCallUser } from "@/src/types/zego";
import { ensureMicrophonePermission } from "@/src/utils/permissions";

function logController(message: string, payload?: Record<string, unknown>) {
  if (payload) {
    console.log(`[AUDIO_CALL_CONTROLLER] ${message}`, payload);
    return;
  }

  console.log(`[AUDIO_CALL_CONTROLLER] ${message}`);
}

function mapZimConnectionState(state: number) {
  switch (state) {
    case ZIMConnectionState.Connecting:
      return "connecting" as const;
    case ZIMConnectionState.Connected:
      return "connected" as const;
    case ZIMConnectionState.Reconnecting:
      return "reconnecting" as const;
    default:
      return "disconnected" as const;
  }
}

function getInvitationEndReason(extendedData: string) {
  if (!extendedData) {
    return null;
  }

  try {
    const parsed = JSON.parse(extendedData) as { reason?: string };
    return typeof parsed.reason === "string" ? parsed.reason : null;
  } catch {
    return null;
  }
}

class AudioCallController {
  private initializePromise: Promise<boolean> | null = null;
  private startCallPromise: Promise<void> | null = null;
  private cleanupPromise: Promise<void> | null = null;
  private initialized = false;
  private removeRtcListeners: (() => void) | null = null;
  private removeZimListeners: (() => void) | null = null;
  private activeRoomID: string | null = null;
  private localStreamID: string | null = null;
  private currentCallID: string | null = null;
  private remoteStreamIDs = new Set<string>();
  private astrologerAccepted = false;
  private inviteTerminationRequested = false;
  private remoteStreamTimeout: ReturnType<typeof setTimeout> | null = null;

  async initialize() {
    if (this.initialized) {
      return true;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = (async () => {
      await this.bindServiceListeners();

      await Promise.all([zegoService.initialize(), zimService.initialize()]);
      await zimService.login(USER_ID);

      useAudioCallStore.getState().patch({
        phase: "idle",
        error: null,
        statusMessage: DEFAULT_STATUS,
      });

      this.initialized = true;
      logController("Controller initialized");
      return true;
    })()
      .catch((error) => {
        useAudioCallStore.getState().patch({
          phase: "error",
          error:
            error instanceof Error
              ? error.message
              : "Unable to initialize ZEGO audio.",
        });

        logController("Controller initialization failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      })
      .finally(() => {
        this.initializePromise = null;
      });

    return this.initializePromise;
  }

  async startCall() {
    const initialized = await this.initialize();

    if (!initialized) {
      return;
    }

    if (this.startCallPromise) {
      return this.startCallPromise;
    }

    this.startCallPromise = (async () => {
      useAudioCallStore.getState().patch({ error: null });
      this.resetSessionState();
      useAudioCallStore.getState().patch({
        phase: "requesting-permission",
        statusMessage: "Checking microphone permission...",
      });

      const permission = await ensureMicrophonePermission();

      logController("Microphone permission result", {
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
        status: permission.status,
      });

      if (!permission.granted) {
        useAudioCallStore.getState().patch({
          phase: "error",
          error: permission.canAskAgain
            ? "Microphone permission was denied. Please allow it and try again."
            : "Microphone permission is blocked. Open device settings and enable microphone access.",
        });
        return;
      }

      const roomID = buildRoomID(USER_ID, ASTROLOGER_ID);
      const expectedLocalStreamID = buildStreamID(roomID, USER_ID);

      this.activeRoomID = roomID;
      this.localStreamID = expectedLocalStreamID;

      useAudioCallStore.getState().patch({
        activeRoomID: roomID,
        localStreamID: expectedLocalStreamID,
        phase: "joining-room",
        statusMessage: "Joining ZEGO room and publishing microphone...",
      });

      logController("Starting user-side call flow", {
        userID: USER_ID,
        astrologerID: ASTROLOGER_ID,
        roomID,
        expectedLocalStreamID,
      });

      const streamID = await zegoService.joinRoom({
        roomID,
        userID: USER_ID,
      });

      this.localStreamID = streamID;
      useAudioCallStore.getState().patch({
        localStreamID: streamID,
        phase: "inviting-astrologer",
        invitationState: "sending",
        statusMessage: "Room joined. Sending call invitation to astrologer...",
      });

      const callID = await zimService.inviteAstrologer({
        roomID,
        callerID: USER_ID,
        calleeID: ASTROLOGER_ID,
      });

      this.currentCallID = callID;
      useAudioCallStore.getState().patch({
        currentCallID: callID,
        invitationState: "waiting",
        phase: "waiting-acceptance",
        statusMessage: "Waiting for astrologer to accept the call...",
      });

      logController("User-side call flow ready", {
        roomID,
        localStreamID: streamID,
        callID,
      });
    })()
      .catch(async (startError) => {
        await this.cleanupRtcOnly().catch(() => {
          // Ignore fallback cleanup failures after start call error.
        });

        logController("startCall failed", {
          error:
            startError instanceof Error
              ? startError.message
              : String(startError),
        });

        useAudioCallStore.getState().patch({
          phase: "error",
          error:
            startError instanceof Error
              ? startError.message
              : "Unable to start the astrology audio call.",
        });
      })
      .finally(() => {
        this.startCallPromise = null;
      });

    return this.startCallPromise;
  }

  async endCall() {
    const initialized = await this.initialize();

    if (!initialized) {
      return;
    }

    try {
      logController("Ending call flow", {
        activeRoomID: this.activeRoomID,
        localStreamID: this.localStreamID,
        callID: this.currentCallID,
        invitationState: useAudioCallStore.getState().invitationState,
        astrologerAccepted: this.astrologerAccepted,
      });

      useAudioCallStore.getState().patch({
        phase: "ending",
        statusMessage: "Ending call...",
      });

      await this.stopPendingOrAcceptedInvite().catch((zimError) => {
        logController("Invitation cleanup failed", {
          error:
            zimError instanceof Error ? zimError.message : String(zimError),
        });
      });

      await this.cleanupRtcOnly();

      useAudioCallStore.getState().patch({
        invitationState: "cancelled",
        phase: "idle",
        statusMessage: DEFAULT_STATUS,
      });
    } catch (leaveError) {
      logController("endCall failed", {
        error:
          leaveError instanceof Error ? leaveError.message : String(leaveError),
      });

      useAudioCallStore.getState().patch({
        phase: "error",
        error:
          leaveError instanceof Error
            ? leaveError.message
            : "Unable to end the call.",
      });
    }
  }

  async toggleMicrophone() {
    const initialized = await this.initialize();

    if (!initialized) {
      return;
    }

    try {
      const nextMutedState = !useAudioCallStore.getState().isMicMuted;
      logController("Toggling microphone", {
        nextMutedState,
      });
      await zegoService.setMicrophoneMuted(nextMutedState);
      useAudioCallStore.getState().patch({
        isMicMuted: nextMutedState,
        statusMessage: nextMutedState
          ? "Microphone muted."
          : "Microphone unmuted.",
      });
    } catch (muteError) {
      logController("toggleMicrophone failed", {
        error:
          muteError instanceof Error ? muteError.message : String(muteError),
      });

      useAudioCallStore.getState().patch({
        error:
          muteError instanceof Error
            ? muteError.message
            : "Unable to update microphone state.",
      });
    }
  }

  private async bindServiceListeners() {
    if (!this.removeRtcListeners) {
      this.removeRtcListeners = await zegoService.addListeners({
        onRoomStateChanged: (roomID, reason, errorCode) => {
          logController("roomStateChanged received", {
            roomID,
            reason,
            errorCode,
          });

          if (errorCode !== 0) {
            useAudioCallStore.getState().patch({
              error: `Room event failed with code ${errorCode}.`,
            });
          }

          switch (reason) {
            case ZegoRoomStateChangedReason.Logining:
              useAudioCallStore.getState().patch({
                rtcConnectionState: "connecting",
                statusMessage: `Connecting to room ${roomID}...`,
              });
              break;
            case ZegoRoomStateChangedReason.Logined:
            case ZegoRoomStateChangedReason.Reconnected:
              useAudioCallStore.getState().patch({
                rtcConnectionState: "connected",
                statusMessage: `Joined room ${roomID}. Waiting for astrologer...`,
              });
              break;
            case ZegoRoomStateChangedReason.Reconnecting:
              useAudioCallStore.getState().patch({
                rtcConnectionState: "reconnecting",
                statusMessage: "Network changed. Reconnecting...",
              });
              break;
            case ZegoRoomStateChangedReason.Logout:
              if (roomID !== this.activeRoomID) {
                break;
              }

              useAudioCallStore.getState().patch({
                statusMessage: "You left the room.",
                rtcConnectionState: "disconnected",
              });

              if (!this.cleanupPromise) {
                this.resetSessionState();
              }
              break;
            case ZegoRoomStateChangedReason.LoginFailed:
            case ZegoRoomStateChangedReason.ReconnectFailed:
            case ZegoRoomStateChangedReason.KickOut:
            case ZegoRoomStateChangedReason.LogoutFailed:
              useAudioCallStore.getState().patch({
                phase: "error",
                rtcConnectionState: "disconnected",
                error: `Room state changed with reason ${reason} and code ${errorCode}.`,
              });
              break;
            default:
              break;
          }
        },
        onRoomUserUpdate: (roomID, updateType, users) => {
          if (roomID !== this.activeRoomID) {
            logController("Ignoring RoomUserUpdate for inactive room", {
              roomID,
              activeRoomID: this.activeRoomID,
              updateType,
              users,
            });
            return;
          }

          logController("RoomUserUpdate", {
            roomID,
            updateType,
            users,
            astrologerAccepted: this.astrologerAccepted,
          });
        },
        onRoomStreamUpdate: (roomID, updateType, streams) => {
          if (roomID !== this.activeRoomID) {
            logController("Ignoring RoomStreamUpdate for inactive room", {
              roomID,
              activeRoomID: this.activeRoomID,
              updateType,
              streamIDs: streams.map((stream) => stream.streamID),
            });
            return;
          }

          logController("RoomStreamUpdate", {
            roomID,
            updateType,
            streamIDs: streams.map((stream) => stream.streamID),
            localStreamID: this.localStreamID,
          });

          if (updateType === ZegoUpdateType.Add) {
            for (const stream of streams) {
              if (stream.streamID === this.localStreamID) {
                logController("Skipping local stream from remote play list", {
                  streamID: stream.streamID,
                });
                continue;
              }

              if (this.remoteStreamIDs.has(stream.streamID)) {
                logController("Skipping duplicate remote stream", {
                  streamID: stream.streamID,
                });
                continue;
              }

              this.remoteStreamIDs.add(stream.streamID);
              useAudioCallStore.getState().upsertRemoteStream(stream);

              logController("Starting remote playback", {
                streamID: stream.streamID,
                remoteUserID: stream.userID,
              });

              void zegoService
                .startPlayingStream(stream.streamID)
                .catch((playError) => {
                  logController("startPlayingStream failed", {
                    streamID: stream.streamID,
                    error:
                      playError instanceof Error
                        ? playError.message
                        : String(playError),
                  });

                  useAudioCallStore.getState().patch({
                    error: `Unable to play remote stream ${stream.streamID}.`,
                  });
                });
            }

            useAudioCallStore.getState().patch({
              phase: "in-call",
              statusMessage: "Astrologer audio stream found. Playing audio.",
            });
            this.clearRemoteStreamWatchdog();
            return;
          }

          const removedStreamIDs = streams.map((stream) => stream.streamID);

          for (const stream of streams) {
            if (!this.remoteStreamIDs.has(stream.streamID)) {
              continue;
            }

            logController("Stopping removed remote stream", {
              streamID: stream.streamID,
            });
            this.remoteStreamIDs.delete(stream.streamID);
            void zegoService.stopPlayingStream(stream.streamID).catch(() => {
              // Ignore stop failures for already-removed remote streams.
            });
          }

          useAudioCallStore.getState().removeRemoteStreams(removedStreamIDs);
          useAudioCallStore.getState().patch({
            statusMessage: "Remote user left the room.",
          });
          this.scheduleRemoteStreamWatchdog(
            "Remote stream was removed. Waiting for astrologer to publish again...",
          );
        },
        onPublisherStateUpdate: (streamID, state, errorCode) => {
          if (streamID !== this.localStreamID) {
            return;
          }

          logController("PublisherStateUpdate", {
            streamID,
            state,
            errorCode,
            isPublishing: state === ZegoPublisherState.Publishing,
            activeRoomID: this.activeRoomID,
            invitationState: useAudioCallStore.getState().invitationState,
          });

          if (errorCode !== 0) {
            useAudioCallStore.getState().patch({
              phase: "error",
              error: `Publishing failed with code ${errorCode}.`,
            });
            return;
          }

          if (state === ZegoPublisherState.Publishing) {
            useAudioCallStore.getState().patch({
              statusMessage: this.astrologerAccepted
                ? "Microphone is live. Astrologer accepted. Waiting for remote stream..."
                : "Microphone is live. Waiting for astrologer...",
            });
          }
        },
        onPlayerStateUpdate: (streamID, state, errorCode) => {
          if (!this.remoteStreamIDs.has(streamID)) {
            return;
          }

          logController("PlayerStateUpdate", {
            streamID,
            state,
            errorCode,
            isPlaying: state === ZegoPlayerState.Playing,
            remoteStreamCount: this.remoteStreamIDs.size,
          });

          if (errorCode !== 0) {
            useAudioCallStore.getState().patch({
              error: `Remote playback failed for ${streamID} with code ${errorCode}.`,
            });
            return;
          }

          if (state === ZegoPlayerState.Playing) {
            useAudioCallStore.getState().patch({
              phase: "in-call",
              statusMessage: "Remote audio is playing.",
            });
            this.clearRemoteStreamWatchdog();
          }
        },
        onDebugError: (errorCode, funcName, info) => {
          logController("debugError received", {
            errorCode,
            funcName,
            info,
          });

          useAudioCallStore.getState().patch({
            error: `ZEGO ${funcName} error ${errorCode}: ${info}`,
          });
        },
      });
    }

    if (!this.removeZimListeners) {
      this.removeZimListeners = await zimService.addListeners({
        onConnectionStateChanged: (state, event, extendedData) => {
          logController("ZIM connectionStateChanged received", {
            state,
            event,
            extendedData,
          });

          useAudioCallStore.getState().patch({
            zimConnectionState: mapZimConnectionState(state),
          });
        },
        onCallInvitationCreated: (callID) => {
          logController("callInvitationCreated received", { callID });
          this.currentCallID = callID;
          useAudioCallStore.getState().patch({ currentCallID: callID });
        },
        onCallUserStateChanged: (callID, users) => {
          logController("callUserStateChanged received", {
            callID,
            users,
          });

          void this.applyAstrologerState(callID, users);
        },
        onCallInvitationTimeout: (callID) => {
          if (callID !== this.currentCallID) {
            return;
          }

          logController("callInvitationTimeout received", { callID });
          useAudioCallStore.getState().patch({
            invitationState: "timed-out",
            statusMessage: "Astrologer did not answer the invitation.",
          });

          void this.cleanupRtcOnly().finally(() => {
            useAudioCallStore.getState().patch({ phase: "idle" });
          });
        },
        onCallInvitationEnded: (callID, extendedData) => {
          if (callID !== this.currentCallID) {
            return;
          }

          const endReason = getInvitationEndReason(extendedData);

          if (this.inviteTerminationRequested) {
            logController("callInvitationEnded local echo ignored", {
              callID,
              endReason,
            });
            return;
          }

          logController("callInvitationEnded", {
            callID,
            extendedData,
            endReason,
            activeRoomID: this.activeRoomID,
            localStreamID: this.localStreamID,
            remoteStreamCount: this.remoteStreamIDs.size,
            astrologerAccepted: this.astrologerAccepted,
          });

          useAudioCallStore.getState().patch({
            invitationState: "ended",
            statusMessage:
              endReason === "caller_cancelled"
                ? "Call invitation was cancelled."
                : "Astrologer ended the invitation.",
          });

          void this.cleanupRtcOnly().finally(() => {
            useAudioCallStore.getState().patch({ phase: "idle" });
          });
        },
        onError: (code, message) => {
          logController("ZIM error received", { code, message });
          useAudioCallStore.getState().patch({
            error: `ZIM error ${code}: ${message}`,
          });
        },
      });
    }
  }

  private async applyAstrologerState(callID: string, users: ZimCallUser[]) {
    const astrologer = users.find((user) => user.userID === ASTROLOGER_ID);

    if (!astrologer || callID !== this.currentCallID) {
      return;
    }

    logController("Processing astrologer invitation state", {
      callID,
      astrologerState: astrologer.state,
    });

    if (astrologer.state === ZIMCallUserState.Accepted) {
      this.astrologerAccepted = true;
      logController("Astrologer accepted invitation", {
        callID,
        activeRoomID: this.activeRoomID,
        localStreamID: this.localStreamID,
        remoteStreamCount: this.remoteStreamIDs.size,
      });
      useAudioCallStore.getState().patch({
        isAstrologerAccepted: true,
        invitationState: "accepted",
        statusMessage:
          "Astrologer accepted. Waiting for remote audio stream...",
      });
      this.scheduleRemoteStreamWatchdog();
      return;
    }

    if (astrologer.state === ZIMCallUserState.Rejected) {
      useAudioCallStore.getState().patch({
        invitationState: "rejected",
        statusMessage: "Astrologer rejected the call.",
      });
      await this.cleanupRtcOnly();
      useAudioCallStore.getState().patch({ phase: "idle" });
      return;
    }

    if (
      astrologer.state === ZIMCallUserState.Timeout ||
      astrologer.state === ZIMCallUserState.Offline
    ) {
      useAudioCallStore.getState().patch({
        invitationState: "timed-out",
        statusMessage: "Astrologer did not accept in time.",
      });
      await this.cleanupRtcOnly();
      useAudioCallStore.getState().patch({ phase: "idle" });
    }
  }

  private async cleanupRtcOnly() {
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    if (!this.activeRoomID && !this.localStreamID) {
      return;
    }

    this.cleanupPromise = (async () => {
      this.clearRemoteStreamWatchdog();

      logController("leaveRoom", {
        roomID: this.activeRoomID,
        localStreamID: this.localStreamID,
        remoteStreams: Array.from(this.remoteStreamIDs),
        callID: this.currentCallID,
        astrologerAccepted: this.astrologerAccepted,
      });

      await zegoService.leaveRoom();
      this.resetSessionState();
    })().finally(() => {
      this.cleanupPromise = null;
    });

    return this.cleanupPromise;
  }

  private async stopPendingOrAcceptedInvite() {
    if (!this.currentCallID) {
      return;
    }

    this.inviteTerminationRequested = true;

    logController("endCallFlow invitation teardown", {
      callID: this.currentCallID,
      astrologerAccepted: this.astrologerAccepted,
      activeRoomID: this.activeRoomID,
      localStreamID: this.localStreamID,
      remoteStreamCount: this.remoteStreamIDs.size,
    });

    if (this.astrologerAccepted) {
      await zimService.endAcceptedCall(this.currentCallID);
      return;
    }

    await zimService.cancelInvitation(this.currentCallID);
  }

  private resetSessionState() {
    logController("Resetting local call session state");

    this.clearRemoteStreamWatchdog();
    this.activeRoomID = null;
    this.localStreamID = null;
    this.currentCallID = null;
    this.remoteStreamIDs.clear();
    this.astrologerAccepted = false;
    this.inviteTerminationRequested = false;

    useAudioCallStore.getState().resetSession();
  }

  private scheduleRemoteStreamWatchdog(
    statusMessage = "Astrologer accepted in ZIM, but no ZEGO remote stream arrived. The receiver must loginRoom and publish in the same room.",
  ) {
    this.clearRemoteStreamWatchdog();

    if (!this.astrologerAccepted || !this.currentCallID) {
      return;
    }

    const trackedCallID = this.currentCallID;

    logController("RemoteStreamWatchdog scheduled", {
      callID: trackedCallID,
      roomID: this.activeRoomID,
      localStreamID: this.localStreamID,
      remoteStreamCount: this.remoteStreamIDs.size,
    });

    this.remoteStreamTimeout = setTimeout(() => {
      if (this.currentCallID !== trackedCallID || this.remoteStreamIDs.size > 0) {
        return;
      }

      logController("RemoteStreamWatchdog fired", {
        callID: this.currentCallID,
        roomID: this.activeRoomID,
        localStreamID: this.localStreamID,
        remoteStreamCount: this.remoteStreamIDs.size,
        astrologerAccepted: this.astrologerAccepted,
      });

      useAudioCallStore.getState().patch({
        error:
          "Remote ZEGO stream did not arrive after invitation acceptance.",
        statusMessage,
      });
    }, 15000);
  }

  private clearRemoteStreamWatchdog() {
    if (!this.remoteStreamTimeout) {
      return;
    }

    logController("RemoteStreamWatchdog cleared", {
      callID: this.currentCallID,
      roomID: this.activeRoomID,
      remoteStreamCount: this.remoteStreamIDs.size,
    });

    clearTimeout(this.remoteStreamTimeout);
    this.remoteStreamTimeout = null;
  }
}

export const audioCallController = new AudioCallController();
