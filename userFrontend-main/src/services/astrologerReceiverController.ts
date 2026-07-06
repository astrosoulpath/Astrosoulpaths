import {
  ZegoPlayerState,
  ZegoPublisherState,
  ZegoRoomStateChangedReason,
  ZegoUpdateType,
} from "zego-express-engine-reactnative";

import { ASTROLOGER_ID } from "@/src/constants/astrologyCall";
import { zegoService } from "@/src/services/zegoService";
import {
  ZIMConnectionState,
  zimService,
} from "@/src/services/zimService";
import {
  RECEIVER_DEFAULT_STATUS,
  useAstrologerReceiverStore,
} from "@/src/store/astrologerReceiverStore";
import { IncomingCallInvitation } from "@/src/types/zego";
import { ensureMicrophonePermission } from "@/src/utils/permissions";

function logReceiver(message: string, payload?: Record<string, unknown>) {
  if (payload) {
    console.log(`[ASTROLOGER_RECEIVER] ${message}`, payload);
    return;
  }

  console.log(`[ASTROLOGER_RECEIVER] ${message}`);
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

class AstrologerReceiverController {
  private initializePromise: Promise<boolean> | null = null;
  private cleanupPromise: Promise<void> | null = null;
  private initialized = false;
  private removeRtcListeners: (() => void) | null = null;
  private removeZimListeners: (() => void) | null = null;
  private activeRoomID: string | null = null;
  private localStreamID: string | null = null;
  private currentCallID: string | null = null;
  private callerID: string | null = null;
  private remoteStreamIDs = new Set<string>();
  private acceptingCall = false;

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
      await zimService.login(ASTROLOGER_ID);

      useAstrologerReceiverStore.getState().patch({
        phase: "listening",
        error: null,
        statusMessage: RECEIVER_DEFAULT_STATUS,
      });

      this.initialized = true;
      logReceiver("Receiver initialized and listening", {
        userID: ASTROLOGER_ID,
      });
      return true;
    })()
      .catch((error) => {
        useAstrologerReceiverStore.getState().patch({
          phase: "error",
          error:
            error instanceof Error
              ? error.message
              : "Unable to initialize astrologer receiver flow.",
        });

        logReceiver("Receiver initialization failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      })
      .finally(() => {
        this.initializePromise = null;
      });

    return this.initializePromise;
  }

  async endCall() {
    const initialized = await this.initialize();

    if (!initialized) {
      return;
    }

    try {
      useAstrologerReceiverStore.getState().patch({
        phase: "ending",
        statusMessage: "Ending astrologer call...",
      });

      if (this.currentCallID) {
        await zimService.endAcceptedCall(this.currentCallID).catch(() => {
          // Ignore accepted-call ZIM cleanup failures during receiver teardown.
        });
      }

      await this.cleanupRtcOnly();
      useAstrologerReceiverStore.getState().patch({
        phase: "listening",
        statusMessage: RECEIVER_DEFAULT_STATUS,
      });
    } catch (error) {
      useAstrologerReceiverStore.getState().patch({
        phase: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to end astrologer receiver call.",
      });
    }
  }

  async toggleMicrophone() {
    const initialized = await this.initialize();

    if (!initialized) {
      return;
    }

    try {
      const nextMutedState = !useAstrologerReceiverStore.getState().isMicMuted;
      await zegoService.setMicrophoneMuted(nextMutedState);
      useAstrologerReceiverStore.getState().patch({
        isMicMuted: nextMutedState,
        statusMessage: nextMutedState
          ? "Astrologer microphone muted."
          : "Astrologer microphone unmuted.",
      });
    } catch (error) {
      useAstrologerReceiverStore.getState().patch({
        error:
          error instanceof Error
            ? error.message
            : "Unable to toggle astrologer microphone.",
      });
    }
  }

  private async bindServiceListeners() {
    if (!this.removeRtcListeners) {
      this.removeRtcListeners = await zegoService.addListeners({
        onRoomStateChanged: (roomID, reason, errorCode) => {
          logReceiver("roomStateChanged received", {
            roomID,
            reason,
            errorCode,
          });

          if (errorCode !== 0) {
            useAstrologerReceiverStore.getState().patch({
              error: `Room event failed with code ${errorCode}.`,
            });
          }

          switch (reason) {
            case ZegoRoomStateChangedReason.Logining:
              useAstrologerReceiverStore.getState().patch({
                rtcConnectionState: "connecting",
                statusMessage: `Joining room ${roomID} as astrologer...`,
              });
              break;
            case ZegoRoomStateChangedReason.Logined:
            case ZegoRoomStateChangedReason.Reconnected:
              useAstrologerReceiverStore.getState().patch({
                rtcConnectionState: "connected",
                statusMessage: `Joined room ${roomID}. Publishing astrologer microphone...`,
              });
              break;
            case ZegoRoomStateChangedReason.Reconnecting:
              useAstrologerReceiverStore.getState().patch({
                rtcConnectionState: "reconnecting",
                statusMessage: "Network changed. Reconnecting astrologer room...",
              });
              break;
            case ZegoRoomStateChangedReason.Logout:
              if (roomID === this.activeRoomID && !this.cleanupPromise) {
                this.resetSessionState();
              }
              break;
            default:
              break;
          }
        },
        onRoomStreamUpdate: (roomID, updateType, streams) => {
          if (roomID !== this.activeRoomID) {
            return;
          }

          logReceiver("roomStreamUpdate received", {
            roomID,
            updateType,
            streamIDs: streams.map((stream) => stream.streamID),
            localStreamID: this.localStreamID,
          });

          if (updateType === ZegoUpdateType.Add) {
            for (const stream of streams) {
              if (stream.streamID === this.localStreamID) {
                continue;
              }

              if (this.remoteStreamIDs.has(stream.streamID)) {
                continue;
              }

              this.remoteStreamIDs.add(stream.streamID);
              useAstrologerReceiverStore.getState().upsertRemoteStream(stream);
              void zegoService.startPlayingStream(stream.streamID).catch((error) => {
                logReceiver("startPlayingStream failed", {
                  streamID: stream.streamID,
                  error: error instanceof Error ? error.message : String(error),
                });
                useAstrologerReceiverStore.getState().patch({
                  error: `Unable to play caller stream ${stream.streamID}.`,
                });
              });
            }

            useAstrologerReceiverStore.getState().patch({
              phase: "in-call",
              statusMessage: "Caller stream found. Playing audio.",
            });
            return;
          }

          const removedStreamIDs = streams.map((stream) => stream.streamID);
          for (const stream of streams) {
            if (!this.remoteStreamIDs.has(stream.streamID)) {
              continue;
            }

            this.remoteStreamIDs.delete(stream.streamID);
            void zegoService.stopPlayingStream(stream.streamID).catch(() => {
              // Ignore stale receiver-side stop failures.
            });
          }

          useAstrologerReceiverStore.getState().removeRemoteStreams(removedStreamIDs);
        },
        onPublisherStateUpdate: (streamID, state, errorCode) => {
          if (streamID !== this.localStreamID) {
            return;
          }

          if (errorCode !== 0) {
            useAstrologerReceiverStore.getState().patch({
              phase: "error",
              error: `Astrologer publish failed with code ${errorCode}.`,
            });
            return;
          }

          if (state === ZegoPublisherState.Publishing) {
            useAstrologerReceiverStore.getState().patch({
              statusMessage: "Astrologer microphone is live. Waiting for caller stream...",
            });
          }
        },
        onPlayerStateUpdate: (streamID, state, errorCode) => {
          if (!this.remoteStreamIDs.has(streamID)) {
            return;
          }

          if (errorCode !== 0) {
            useAstrologerReceiverStore.getState().patch({
              error: `Caller playback failed for ${streamID} with code ${errorCode}.`,
            });
            return;
          }

          if (state === ZegoPlayerState.Playing) {
            useAstrologerReceiverStore.getState().patch({
              phase: "in-call",
              statusMessage: "Caller audio is playing on astrologer device.",
            });
          }
        },
        onDebugError: (errorCode, funcName, info) => {
          useAstrologerReceiverStore.getState().patch({
            error: `ZEGO ${funcName} error ${errorCode}: ${info}`,
          });
        },
      });
    }

    if (!this.removeZimListeners) {
      this.removeZimListeners = await zimService.addListeners({
        onConnectionStateChanged: (state) => {
          useAstrologerReceiverStore.getState().patch({
            zimConnectionState: mapZimConnectionState(state),
          });
        },
        onCallInvitationReceived: (invitation) => {
          void this.acceptIncomingInvitation(invitation);
        },
        onCallInvitationEnded: (callID) => {
          if (callID !== this.currentCallID) {
            return;
          }

          void this.cleanupRtcOnly().finally(() => {
            useAstrologerReceiverStore.getState().patch({
              phase: "listening",
              statusMessage: RECEIVER_DEFAULT_STATUS,
            });
          });
        },
        onError: (code, message) => {
          useAstrologerReceiverStore.getState().patch({
            error: `ZIM error ${code}: ${message}`,
          });
        },
      });
    }
  }

  private async acceptIncomingInvitation(invitation: IncomingCallInvitation) {
    if (this.acceptingCall) {
      logReceiver("Ignoring invitation while another call is being accepted", {
        callID: invitation.callID,
      });
      return;
    }

    this.acceptingCall = true;

    try {
      if (!invitation.roomID) {
        throw new Error("Incoming invitation is missing ZEGO roomID.");
      }

      this.currentCallID = invitation.callID;
      this.activeRoomID = invitation.roomID;
      this.callerID = invitation.callerID;

      useAstrologerReceiverStore.getState().patch({
        phase: "incoming-invite",
        currentCallID: invitation.callID,
        activeRoomID: invitation.roomID,
        callerID: invitation.callerID,
        error: null,
        statusMessage: `Incoming call from ${invitation.callerID}. Accepting...`,
      });

      const permission = await ensureMicrophonePermission();

      if (!permission.granted) {
        await zimService.rejectInvitation(
          invitation.callID,
          JSON.stringify({ reason: "microphone_permission_denied" }),
        );
        throw new Error(
          "Astrologer device microphone permission is denied. Call was rejected.",
        );
      }

      useAstrologerReceiverStore.getState().patch({
        phase: "accepting",
        statusMessage: "Invitation accepted. Joining ZEGO room...",
      });

      await zimService.acceptInvitation(
        invitation.callID,
        JSON.stringify({ roomID: invitation.roomID, receiverID: ASTROLOGER_ID }),
      );

      const streamID = await zegoService.joinRoom({
        roomID: invitation.roomID,
        userID: ASTROLOGER_ID,
      });

      this.localStreamID = streamID;
      useAstrologerReceiverStore.getState().patch({
        phase: "joining-room",
        localStreamID: streamID,
        statusMessage:
          "Astrologer joined room and started publishing. Waiting for caller stream...",
      });
    } catch (error) {
      logReceiver("acceptIncomingInvitation failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      useAstrologerReceiverStore.getState().patch({
        phase: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to accept incoming audio call.",
      });
    } finally {
      this.acceptingCall = false;
    }
  }

  private async cleanupRtcOnly() {
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    if (!this.activeRoomID && !this.localStreamID) {
      this.resetSessionState();
      return;
    }

    this.cleanupPromise = (async () => {
      await zegoService.leaveRoom();
      this.resetSessionState();
    })().finally(() => {
      this.cleanupPromise = null;
    });

    return this.cleanupPromise;
  }

  private resetSessionState() {
    this.activeRoomID = null;
    this.localStreamID = null;
    this.currentCallID = null;
    this.callerID = null;
    this.remoteStreamIDs.clear();
    this.acceptingCall = false;

    useAstrologerReceiverStore.getState().resetSession();
  }
}

export const astrologerReceiverController = new AstrologerReceiverController();