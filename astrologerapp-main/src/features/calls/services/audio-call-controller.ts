import {
  ASTROLOGER_USER_ID,
  ASTROLOGER_USER_NAME,
  CALLER_ID,
  CALLER_NAME,
  ROOM_ID,
  getLocalStreamID,
} from "@/src/constants/audio-call";
import { ensureMicrophonePermission } from "@/src/features/calls/utils/microphonePermission";
import { createLogger } from "@/src/lib/logger";
import {
  type CallInvitationEndedEvent,
  type IncomingCallInvite,
  zegoCallInviteService,
} from "@/src/services/zego-call-invite-service";
import { zegoAudioRoomService } from "@/src/services/zego-audio-room-service";
import {
  type ActiveCall,
  useAudioCallStore,
} from "@/src/features/calls/store/audio-call-store";
import { AppState } from "react-native";
import { ZegoPlayerState, ZegoPublisherState, ZegoRoomStateChangedReason, ZegoUpdateType } from "zego-express-engine-reactnative";

const logger = createLogger("AudioCallController");
const ACCEPT_RETRY_DELAY_MS = 800;
const ROOM_RESET_DELAY_MS = 500;

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

class AudioCallController {
  private activeOperationSerial = 0;
  private isAccepting = false;
  private started = false;
  private startPromise: Promise<void> | null = null;
  private unsubscribeInvite: (() => void) | null = null;
  private unsubscribeRoom: (() => void) | null = null;

  async start() {
    if (this.started) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.bootstrap();
    await this.startPromise;
    this.startPromise = null;
  }

  async acceptCall() {
    const store = useAudioCallStore.getState();
    const invite = store.incomingInvite;

    if (
      this.isAccepting ||
      !invite ||
      store.stage === "connecting" ||
      store.stage === "in-call"
    ) {
      if (this.isAccepting) {
        store.appendLog("Ignoring duplicate accept tap while the current accept flow is still running");
      }
      return;
    }

    this.isAccepting = true;

    const operationSerial = ++this.activeOperationSerial;

    const provisionalCall: ActiveCall = {
      callID: invite.callID,
      callerID: invite.callerID,
      callerName: invite.callerName,
      roomID: invite.roomID,
      token: invite.token,
    };

    store.clearError();
    store.setActiveCall(provisionalCall);
    store.setStage("connecting");
    store.appendLog(`Accepting incoming call ${invite.callID}`);

    try {
      // Accept can be triggered while the app is resuming from background.
      // Give the JS/native bridge a short window to settle before touching ZEGO room state.
      if (AppState.currentState !== "active") {
        store.appendLog(
          `App is ${AppState.currentState}; waiting ${ACCEPT_RETRY_DELAY_MS}ms before answering the call`,
        );
        await wait(ACCEPT_RETRY_DELAY_MS);
      }

      const granted = await ensureMicrophonePermission();

      if (!granted) {
        throw new Error("Microphone permission is required to answer the call.");
      }

      await zegoCallInviteService.acceptCall(invite.callID, invite.roomID);

      // Fully drain any previous ZEGO room teardown before starting the next login.
      await zegoAudioRoomService.leaveRoom();

      // ZEGO native state can lag the JS promise chain briefly after logout.
      await wait(ROOM_RESET_DELAY_MS);

      await zegoAudioRoomService.joinRoom({
        roomID: invite.roomID,
        streamID: getLocalStreamID(
          ASTROLOGER_USER_ID,
          invite.roomID,
          invite.callID,
        ),
        token: invite.token,
        userID: ASTROLOGER_USER_ID,
        userName: ASTROLOGER_USER_NAME,
      });

      if (operationSerial !== this.activeOperationSerial) {
        logger.warn("Ignoring stale accept result", {
          callID: invite.callID,
          operationSerial,
        });
        return;
      }

      useAudioCallStore.setState({
        activeCall: provisionalCall,
        errorMessage: null,
        incomingInvite: null,
        stage: "in-call",
      });
      useAudioCallStore
        .getState()
        .appendLog(
          `Joined room ${invite.roomID}. Local publish is live and waiting for remote playback.`,
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (operationSerial !== this.activeOperationSerial) {
        logger.warn("Ignoring stale accept failure", {
          callID: invite.callID,
          message,
          operationSerial,
        });
        return;
      }

      useAudioCallStore.setState({
        activeCall: null,
        errorMessage: message,
        stage: "error",
      });
      useAudioCallStore.getState().appendLog(`Accept flow failed: ${message}`);
      await zegoAudioRoomService.leaveRoom();
    } finally {
      this.isAccepting = false;
    }
  }

  async endCall() {
    const store = useAudioCallStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall) {
      return;
    }

    ++this.activeOperationSerial;

    try {
      store.clearError();
      store.appendLog("Ending active call");
      await zegoCallInviteService.quitCall(activeCall.callID, activeCall.roomID);
      await zegoAudioRoomService.leaveRoom();
      useAudioCallStore.getState().resetForIdle();
      useAudioCallStore.getState().appendLog("Left current call");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
        stage: "error",
      });
      useAudioCallStore.getState().appendLog(`Ending call failed: ${message}`);
    }
  }

  async rejectCall() {
    const store = useAudioCallStore.getState();
    const invite = store.incomingInvite;

    if (!invite) {
      return;
    }

    ++this.activeOperationSerial;

    try {
      await zegoCallInviteService.rejectCall(invite.callID);
      useAudioCallStore.setState({
        incomingInvite: null,
        stage: "waiting",
      });
      useAudioCallStore.getState().appendLog("Call invitation rejected");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
        stage: "error",
      });
      useAudioCallStore.getState().appendLog(`Reject flow failed: ${message}`);
    }
  }

  simulateIncomingCall() {
    const mockInvite: IncomingCallInvite = {
      callID: `mock-${Date.now()}`,
      callerID: CALLER_ID,
      callerName: CALLER_NAME,
      inviterID: CALLER_ID,
      rawExtendedData: JSON.stringify({ callerID: CALLER_ID, roomID: ROOM_ID }),
      receivedAt: Date.now(),
      roomID: ROOM_ID,
      token: undefined,
    };

    useAudioCallStore.setState({
      errorMessage: null,
      incomingInvite: mockInvite,
      stage: "incoming",
    });
    useAudioCallStore
      .getState()
      .appendLog("Loaded a local test invite for UI verification");
  }

  async toggleMicrophone() {
    try {
      await zegoAudioRoomService.toggleMicrophone();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({ errorMessage: message });
      useAudioCallStore
        .getState()
        .appendLog(`Microphone toggle failed: ${message}`);
    }
  }

  async toggleSpeaker() {
    try {
      await zegoAudioRoomService.toggleSpeaker();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({ errorMessage: message });
      useAudioCallStore.getState().appendLog(`Speaker toggle failed: ${message}`);
    }
  }

  async handleAppStateChange(nextAppState: string) {
    const store = useAudioCallStore.getState();

    store.appendLog(`App lifecycle changed to ${nextAppState}`);

    if (store.stage !== "connecting" && store.stage !== "in-call") {
      return;
    }

    try {
      await zegoAudioRoomService.handleAppStateChange(nextAppState);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({ errorMessage: message });
      store.appendLog(`App lifecycle recovery failed: ${message}`);
    }
  }

  private async bootstrap() {
    if (this.started) {
      return;
    }

    this.registerSubscriptions();

    try {
      await zegoCallInviteService.initialize(
        ASTROLOGER_USER_ID,
        ASTROLOGER_USER_NAME,
      );
      useAudioCallStore
        .getState()
        .appendLog(`Listening for calls as ${ASTROLOGER_USER_ID}`);
      this.started = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
        stage: "error",
      });
      useAudioCallStore
        .getState()
        .appendLog(`Failed to initialize ZEGO services: ${message}`);
      logger.error("Failed to bootstrap call controller", error);
    }
  }

  private handleInviteEnded(event: CallInvitationEndedEvent) {
    const store = useAudioCallStore.getState();
    const activeCall = store.activeCall;
    const isAcceptedCall = activeCall?.callID === event.callID;

    if (isAcceptedCall || store.stage === "connecting" || store.stage === "in-call") {
      store.appendLog(
        `Invitation lifecycle ended for ${event.callID} without forcing RTC teardown.`,
      );
      logger.info("Ignoring invitation-ended event for active RTC session", event);
      return;
    }

    if (store.incomingInvite?.callID === event.callID) {
      useAudioCallStore.setState({
        incomingInvite: null,
        stage: "waiting",
      });
      store.appendLog("Call invitation ended before the room was joined");
    }
  }

  private registerSubscriptions() {
    if (!this.unsubscribeInvite) {
      this.unsubscribeInvite = zegoCallInviteService.subscribe({
        onConnectionStateChange: (stateLabel) => {
          useAudioCallStore.getState().setConnectionState(stateLabel);
        },
        onIncomingInvite: (invite) => {
          useAudioCallStore.setState({
            errorMessage: null,
            incomingInvite: invite,
            stage: "incoming",
          });
          useAudioCallStore
            .getState()
            .appendLog(
              `Incoming call from ${invite.callerName} for room ${invite.roomID}`,
            );
        },
        onInviteCancelled: (callID) => {
          const store = useAudioCallStore.getState();

          if (store.activeCall?.callID === callID) {
            store.appendLog(
              `Invitation cancel received for active call ${callID}; RTC remains authoritative.`,
            );
            return;
          }

          useAudioCallStore.setState((state) => ({
            incomingInvite:
              state.incomingInvite?.callID === callID ? null : state.incomingInvite,
            stage: state.stage === "in-call" ? state.stage : "waiting",
          }));
          useAudioCallStore.getState().appendLog("Caller cancelled the invitation");
        },
        onInviteEnded: (event) => {
          this.handleInviteEnded(event);
        },
        onInviteTimeout: (callID) => {
          useAudioCallStore.setState((state) => ({
            incomingInvite:
              state.incomingInvite?.callID === callID ? null : state.incomingInvite,
            stage: "waiting",
          }));
          useAudioCallStore.getState().appendLog("Incoming invitation timed out");
        },
        onReadyChange: (ready) => {
          useAudioCallStore.getState().setReady(ready);
        },
      });
    }

    if (!this.unsubscribeRoom) {
      this.unsubscribeRoom = zegoAudioRoomService.subscribe({
        onLog: (message) => {
          useAudioCallStore.getState().appendLog(message);
        },
        onMicrophoneStateChange: (muted) => {
          useAudioCallStore.getState().setMicMuted(muted);
        },
        onPlayerStateUpdate: (streamID, state, errorCode) => {
          if (state === ZegoPlayerState.Playing) {
            useAudioCallStore.getState().appendLog(
              `Remote stream ${streamID} is now playing.`,
            );
          }

          if (errorCode !== 0) {
            useAudioCallStore
              .getState()
              .appendLog(
                `Remote stream ${streamID} playback failed with ZEGO code ${errorCode}.`,
              );
          }
        },
        onPublisherStateUpdate: (streamID, state, errorCode) => {
          if (state === ZegoPublisherState.Publishing) {
            useAudioCallStore.getState().appendLog(
              `Local stream ${streamID} is publishing.`,
            );
          }

          if (errorCode !== 0) {
            useAudioCallStore
              .getState()
              .appendLog(
                `Local stream ${streamID} publish failed with ZEGO code ${errorCode}.`,
              );
          }
        },
        onRemoteParticipantCountChange: (count) => {
          useAudioCallStore.getState().setRemoteParticipantCount(count);
        },
        onRemoteSoundLevelUpdate: (soundLevels) => {
          const activeStreamCount = Object.keys(soundLevels).length;

          if (activeStreamCount > 0) {
            useAudioCallStore.getState().appendLog(
              `Remote sound levels received for ${activeStreamCount} stream(s).`,
            );
          }
        },
        onRoomStateChanged: (_roomID, reason, errorCode) => {
          const store = useAudioCallStore.getState();

          if (reason === ZegoRoomStateChangedReason.Reconnecting) {
            store.setStage("reconnecting");
          }

          if (
            store.activeCall &&
            (reason === ZegoRoomStateChangedReason.Logined ||
              reason === ZegoRoomStateChangedReason.Reconnected)
          ) {
            store.setStage("in-call");
          }

          if (reason === ZegoRoomStateChangedReason.ReconnectFailed) {
            store.setErrorMessage(
              `Room reconnect failed with ZEGO code ${errorCode}.`,
            );
            store.setStage("error");
          }
        },
        onRoomStateChange: (stateLabel) => {
          useAudioCallStore.getState().setRoomState(stateLabel);
        },
        onRoomStreamUpdate: (_roomID, updateType, streamList) => {
          const messagePrefix =
            updateType === ZegoUpdateType.Add ? "Discovered" : "Removed";

          for (const stream of streamList) {
            useAudioCallStore
              .getState()
              .appendLog(`${messagePrefix} remote stream ${stream.streamID}.`);
          }
        },
        onSpeakerStateChange: (enabled, routeLabel) => {
          useAudioCallStore.getState().setSpeakerState(enabled, routeLabel);
        },
      });
    }
  }
}

export const audioCallController = new AudioCallController();