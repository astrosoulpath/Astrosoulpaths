import {
  ASTROLOGER_USER_ID,
  ASTROLOGER_USER_NAME,
  CALLER_ID,
  CALLER_NAME,
  ROOM_ID,
  getLocalStreamID,
} from "@/src/constants/audio-call";
import {
  type ActiveCall,
  useAudioCallStore,
} from "@/src/features/calls/store/audio-call-store";
import { createLogger } from "@/src/lib/logger";
import { zegoAudioRoomService } from "@/src/services/zego-audio-room-service";
import {
  type CallInvitationEndedEvent,
  type IncomingCallInvite,
  zegoCallInviteService,
} from "@/src/services/zego-call-invite-service";

const logger = createLogger("AudioCallControllerWeb");
const ROOM_RESET_DELAY_MS = 300;

const WEB_PLAYER_STATE_PLAYING = 2;
const WEB_PUBLISHER_STATE_PUBLISHING = 2;

const WEB_ROOM_REASON = {
  LoginFailed: 1,
  Logined: 2,
  Reconnecting: 3,
  Reconnected: 4,
  ReconnectFailed: 5,
  KickOut: 6,
  Logout: 7,
  LogoutFailed: 8,
} as const;

const WEB_STREAM_UPDATE_TYPE = {
  Add: 0,
  Delete: 1,
} as const;

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

class AudioCallControllerWeb {
  private activeOperationSerial = 0;
  private isAccepting = false;
  private started = false;
  private startPromise: Promise<void> | null = null;
  private unsubscribeInvite: (() => void) | null = null;
  private unsubscribeRoom: (() => void) | null = null;

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.bootstrap();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async acceptCall(): Promise<void> {
    const store = useAudioCallStore.getState();
    const invite = store.incomingInvite;

    if (
      this.isAccepting ||
      !invite ||
      store.stage === "connecting" ||
      store.stage === "in-call"
    ) {
      if (this.isAccepting) {
        store.appendLog(
          "Ignoring duplicate accept tap while the current web accept flow is running.",
        );
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
    store.appendLog(`Accepting browser call ${invite.callID}`);

    try {
      this.ensureBrowserAudioSupport();

      await zegoCallInviteService.acceptCall(
        invite.callID,
        invite.roomID,
      );

      await zegoAudioRoomService.leaveRoom();
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
        logger.warn("Ignoring stale web accept result", {
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
          `Joined browser audio room ${invite.roomID}. Local microphone is publishing.`,
        );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      if (operationSerial !== this.activeOperationSerial) {
        logger.warn("Ignoring stale web accept failure", {
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

      useAudioCallStore
        .getState()
        .appendLog(`Browser accept flow failed: ${message}`);

      await zegoAudioRoomService.leaveRoom();
    } finally {
      this.isAccepting = false;
    }
  }

  async endCall(): Promise<void> {
    const store = useAudioCallStore.getState();
    const activeCall = store.activeCall;

    if (!activeCall) {
      return;
    }

    ++this.activeOperationSerial;

    try {
      store.clearError();
      store.appendLog("Ending browser audio call");

      await zegoCallInviteService.quitCall(
        activeCall.callID,
        activeCall.roomID,
      );

      await zegoAudioRoomService.leaveRoom();

      useAudioCallStore.getState().resetForIdle();
      useAudioCallStore
        .getState()
        .appendLog("Left browser audio call");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
        stage: "error",
      });

      useAudioCallStore
        .getState()
        .appendLog(`Ending browser call failed: ${message}`);
    }
  }

  async rejectCall(): Promise<void> {
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

      useAudioCallStore
        .getState()
        .appendLog("Browser call invitation rejected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
        stage: "error",
      });

      useAudioCallStore
        .getState()
        .appendLog(`Browser reject flow failed: ${message}`);
    }
  }

  simulateIncomingCall(): void {
    const mockInvite: IncomingCallInvite = {
      callID: `web-mock-${Date.now()}`,
      callerID: CALLER_ID,
      callerName: CALLER_NAME,
      inviterID: CALLER_ID,
      rawExtendedData: JSON.stringify({
        callerID: CALLER_ID,
        callerName: CALLER_NAME,
        roomID: ROOM_ID,
      }),
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
      .appendLog(
        "Loaded a browser test invitation for call UI verification.",
      );
  }

  async toggleMicrophone(): Promise<void> {
    try {
      await zegoAudioRoomService.toggleMicrophone();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
      });

      useAudioCallStore
        .getState()
        .appendLog(`Browser microphone toggle failed: ${message}`);
    }
  }

  async toggleSpeaker(): Promise<void> {
    try {
      await zegoAudioRoomService.toggleSpeaker();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
      });

      useAudioCallStore
        .getState()
        .appendLog(`Browser speaker toggle failed: ${message}`);
    }
  }

  async handleAppStateChange(
    nextAppState: string,
  ): Promise<void> {
    const store = useAudioCallStore.getState();

    store.appendLog(
      `Browser lifecycle changed to ${nextAppState}`,
    );

    if (
      store.stage !== "connecting" &&
      store.stage !== "in-call" &&
      store.stage !== "reconnecting"
    ) {
      return;
    }

    try {
      await zegoAudioRoomService.handleAppStateChange(
        nextAppState,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
      });

      store.appendLog(
        `Browser lifecycle recovery failed: ${message}`,
      );
    }
  }

  private async bootstrap(): Promise<void> {
    if (this.started) {
      return;
    }

    this.registerSubscriptions();

    try {
      this.ensureBrowserAudioSupport();

      await zegoCallInviteService.initialize(
        ASTROLOGER_USER_ID,
        ASTROLOGER_USER_NAME,
      );

      useAudioCallStore
        .getState()
        .appendLog(
          `Browser is listening for calls as ${ASTROLOGER_USER_ID}`,
        );

      this.started = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      useAudioCallStore.setState({
        errorMessage: message,
        stage: "error",
      });

      useAudioCallStore
        .getState()
        .appendLog(
          `Failed to initialize browser ZEGO services: ${message}`,
        );

      logger.error(
        "Failed to bootstrap browser call controller",
        error,
      );
    }
  }

  private ensureBrowserAudioSupport(): void {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined"
    ) {
      throw new Error(
        "Browser audio calling is unavailable outside a browser.",
      );
    }

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      throw new Error(
        "This browser does not support microphone audio calling.",
      );
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!window.isSecureContext && !isLocalhost) {
      throw new Error(
        "Browser audio calling requires HTTPS.",
      );
    }
  }

  private handleInviteEnded(
    event: CallInvitationEndedEvent,
  ): void {
    const store = useAudioCallStore.getState();
    const activeCall = store.activeCall;

    const isAcceptedCall =
      activeCall?.callID === event.callID;

    if (
      isAcceptedCall ||
      store.stage === "connecting" ||
      store.stage === "in-call" ||
      store.stage === "reconnecting"
    ) {
      store.appendLog(
        `Invitation lifecycle ended for ${event.callID}; browser RTC room remains active.`,
      );

      logger.info(
        "Ignoring invitation-ended event for active browser RTC session",
        event,
      );

      return;
    }

    if (store.incomingInvite?.callID === event.callID) {
      useAudioCallStore.setState({
        incomingInvite: null,
        stage: "waiting",
      });

      store.appendLog(
        "Browser call invitation ended before room join.",
      );
    }
  }

  private registerSubscriptions(): void {
    if (!this.unsubscribeInvite) {
      this.unsubscribeInvite =
        zegoCallInviteService.subscribe({
          onConnectionStateChange: (stateLabel) => {
            useAudioCallStore
              .getState()
              .setConnectionState(stateLabel);
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
                `Incoming browser call from ${invite.callerName} for room ${invite.roomID}`,
              );
          },

          onInviteCancelled: (callID) => {
            const store = useAudioCallStore.getState();

            if (store.activeCall?.callID === callID) {
              store.appendLog(
                `Invitation cancellation received for active browser call ${callID}; RTC remains active.`,
              );

              return;
            }

            useAudioCallStore.setState((state) => ({
              incomingInvite:
                state.incomingInvite?.callID === callID
                  ? null
                  : state.incomingInvite,
              stage:
                state.stage === "in-call"
                  ? state.stage
                  : "waiting",
            }));

            useAudioCallStore
              .getState()
              .appendLog(
                "Caller cancelled the browser invitation.",
              );
          },

          onInviteEnded: (event) => {
            this.handleInviteEnded(event);
          },

          onInviteTimeout: (callID) => {
            useAudioCallStore.setState((state) => ({
              incomingInvite:
                state.incomingInvite?.callID === callID
                  ? null
                  : state.incomingInvite,
              stage:
                state.stage === "in-call"
                  ? state.stage
                  : "waiting",
            }));

            useAudioCallStore
              .getState()
              .appendLog(
                "Browser incoming invitation timed out.",
              );
          },

          onReadyChange: (ready) => {
            useAudioCallStore
              .getState()
              .setReady(ready);
          },
        });
    }

    if (!this.unsubscribeRoom) {
      this.unsubscribeRoom =
        zegoAudioRoomService.subscribe({
          onLog: (message) => {
            useAudioCallStore
              .getState()
              .appendLog(message);
          },

          onMicrophoneStateChange: (muted) => {
            useAudioCallStore
              .getState()
              .setMicMuted(muted);
          },

          onPlayerStateUpdate: (
            streamID,
            state,
            errorCode,
          ) => {
            if (state === WEB_PLAYER_STATE_PLAYING) {
              useAudioCallStore
                .getState()
                .appendLog(
                  `Remote browser stream ${streamID} is playing.`,
                );
            }

            if (errorCode !== 0) {
              useAudioCallStore
                .getState()
                .appendLog(
                  `Remote browser stream ${streamID} playback failed with ZEGO code ${errorCode}.`,
                );
            }
          },

          onPublisherStateUpdate: (
            streamID,
            state,
            errorCode,
          ) => {
            if (
              state === WEB_PUBLISHER_STATE_PUBLISHING
            ) {
              useAudioCallStore
                .getState()
                .appendLog(
                  `Local browser stream ${streamID} is publishing.`,
                );
            }

            if (errorCode !== 0) {
              useAudioCallStore
                .getState()
                .appendLog(
                  `Local browser stream ${streamID} publish failed with ZEGO code ${errorCode}.`,
                );
            }
          },

          onRemoteParticipantCountChange: (count) => {
            useAudioCallStore
              .getState()
              .setRemoteParticipantCount(count);
          },

          onRemoteSoundLevelUpdate: (soundLevels) => {
            const activeStreamCount =
              Object.keys(soundLevels).length;

            if (activeStreamCount > 0) {
              useAudioCallStore
                .getState()
                .appendLog(
                  `Browser remote sound received for ${activeStreamCount} stream(s).`,
                );
            }
          },

          onRoomStateChanged: (
            _roomID,
            reason,
            errorCode,
          ) => {
            const store =
              useAudioCallStore.getState();

            if (
              reason ===
              WEB_ROOM_REASON.Reconnecting
            ) {
              store.setStage("reconnecting");
            }

            if (
              store.activeCall &&
              (reason === WEB_ROOM_REASON.Logined ||
                reason ===
                  WEB_ROOM_REASON.Reconnected)
            ) {
              store.setStage("in-call");
            }

            if (
              reason ===
                WEB_ROOM_REASON.ReconnectFailed ||
              reason === WEB_ROOM_REASON.LoginFailed
            ) {
              store.setErrorMessage(
                `Browser room connection failed with ZEGO code ${errorCode}.`,
              );

              store.setStage("error");
            }

            if (reason === WEB_ROOM_REASON.KickOut) {
              store.setErrorMessage(
                "The browser call was ended because this account was disconnected.",
              );

              store.setStage("error");
            }
          },

          onRoomStateChange: (stateLabel) => {
            useAudioCallStore
              .getState()
              .setRoomState(stateLabel);
          },

          onRoomStreamUpdate: (
            _roomID,
            updateType,
            streamList,
          ) => {
            const messagePrefix =
              updateType ===
              WEB_STREAM_UPDATE_TYPE.Add
                ? "Discovered"
                : "Removed";

            for (const stream of streamList) {
              useAudioCallStore
                .getState()
                .appendLog(
                  `${messagePrefix} browser remote stream ${stream.streamID}.`,
                );
            }
          },

          onSpeakerStateChange: (
            enabled,
            routeLabel,
          ) => {
            useAudioCallStore
              .getState()
              .setSpeakerState(
                enabled,
                routeLabel,
              );
          },
        });
    }
  }
}

export const audioCallController =
  new AudioCallControllerWeb();