import ZIM, {
  ZIMConnectionState,
  ZIMEventOfCallInvitationReceivedResult,
} from "zego-zim-react-native";

import { getZegoConfig } from "@/src/features/calls/config/zego.config";
import { createLogger } from "@/src/lib/logger";
import {
  buildAcceptExtendedData,
  buildQuitExtendedData,
  buildRejectExtendedData,
  parseAudioCallInvitation,
} from "@/src/utils/audio-call-invitation";

const logger = createLogger("ZegoCallInviteService");

export type IncomingCallInvite = {
  callID: string;
  callerID: string;
  callerName: string;
  inviterID: string;
  roomID: string;
  token?: string;
  rawExtendedData: string;
  receivedAt: number;
};

export type CallInvitationEndedEvent = {
  callID: string;
  extendedData: string;
  operatedUserID?: string;
};

type CallInviteListener = {
  onConnectionStateChange?: (stateLabel: string) => void;
  onIncomingInvite?: (invite: IncomingCallInvite) => void;
  onInviteCancelled?: (callID: string) => void;
  onInviteEnded?: (event: CallInvitationEndedEvent) => void;
  onInviteTimeout?: (callID: string) => void;
  onReadyChange?: (ready: boolean) => void;
};

class ZegoCallInviteService {
  private currentUserID: string | null = null;
  private initialized = false;
  private listeners = new Set<CallInviteListener>();
  private loggedIn = false;
  private zim: ZIM | null = null;

  subscribe(listener: CallInviteListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async initialize(userID: string, userName: string) {
    if (this.loggedIn && this.currentUserID === userID && this.zim) {
      return this.zim;
    }

    const config = getZegoConfig();

    if (!this.zim) {
      this.zim =
        ZIM.getInstance() ??
        ZIM.create({
          appID: config.appID,
          appSign: config.appSign,
        });
    }

    if (!this.zim) {
      throw new Error("Failed to create ZEGO ZIM singleton.");
    }

    if (!this.initialized) {
      this.registerHandlers(this.zim);
      this.initialized = true;
    }

    if (this.loggedIn && this.currentUserID && this.currentUserID !== userID) {
      this.zim.logout();
      this.loggedIn = false;
    }

    await this.zim.login(userID, {
      customStatus: "available",
      isOfflineLogin: false,
      token: "",
      userName,
    });

    this.currentUserID = userID;
    this.loggedIn = true;
    this.emitReady(true);
    logger.info("ZEGO ZIM logged in", { userID });

    return this.zim;
  }

  async acceptCall(callID: string, roomID: string) {
    const zim = this.ensureZim();

    await zim.callAccept(callID, {
      extendedData: buildAcceptExtendedData(roomID),
    });

    logger.info("Accepted call invitation", { callID, roomID });
  }

  async rejectCall(callID: string, reason = "declined") {
    const zim = this.ensureZim();

    await zim.callReject(callID, {
      extendedData: buildRejectExtendedData(reason),
    });

    logger.info("Rejected call invitation", { callID, reason });
  }

  async quitCall(callID: string, roomID: string) {
    const zim = this.ensureZim();

    await zim.callQuit(callID, {
      extendedData: buildQuitExtendedData(roomID),
    });

    logger.info("Quit active call invitation", { callID, roomID });
  }

  async cleanup() {
    if (!this.zim) {
      return;
    }

    if (this.loggedIn) {
      this.zim.logout();
    }

    this.zim.destroy();
    this.zim = null;
    this.initialized = false;
    this.loggedIn = false;
    this.currentUserID = null;
    this.emitReady(false);
  }

  private emitConnectionState(stateLabel: string) {
    for (const listener of this.listeners) {
      listener.onConnectionStateChange?.(stateLabel);
    }
  }

  private emitIncomingInvite(invite: IncomingCallInvite) {
    for (const listener of this.listeners) {
      listener.onIncomingInvite?.(invite);
    }
  }

  private emitInviteCancelled(callID: string) {
    for (const listener of this.listeners) {
      listener.onInviteCancelled?.(callID);
    }
  }

  private emitInviteEnded(event: CallInvitationEndedEvent) {
    for (const listener of this.listeners) {
      listener.onInviteEnded?.(event);
    }
  }

  private emitInviteTimeout(callID: string) {
    for (const listener of this.listeners) {
      listener.onInviteTimeout?.(callID);
    }
  }

  private emitReady(ready: boolean) {
    for (const listener of this.listeners) {
      listener.onReadyChange?.(ready);
    }
  }

  private ensureZim() {
    if (!this.zim) {
      throw new Error("ZEGO ZIM is not initialized.");
    }

    return this.zim;
  }

  private mapIncomingInvite(
    data: ZIMEventOfCallInvitationReceivedResult,
  ): IncomingCallInvite {
    const parsed = parseAudioCallInvitation(data.extendedData);

    return {
      callID: data.callID,
      callerID: parsed.callerID,
      callerName: parsed.callerName,
      inviterID: data.inviter,
      rawExtendedData: parsed.rawExtendedData,
      receivedAt: data.createTime,
      roomID: parsed.roomID,
      token: parsed.token,
    };
  }

  private registerHandlers(zim: ZIM) {
    zim.on("connectionStateChanged", (_zim, data) => {
      const stateLabel = ZIMConnectionState[data.state] ?? String(data.state);
      this.emitConnectionState(stateLabel);
      logger.info("ZIM connection state changed", {
        event: data.event,
        extendedData: data.extendedData,
        state: stateLabel,
      });
    });

    zim.on("callInvitationReceived", (_zim, data) => {
      const invite = this.mapIncomingInvite(data);
      this.emitIncomingInvite(invite);
      logger.info("Incoming call invitation received", {
        callID: invite.callID,
        callerID: invite.callerID,
        roomID: invite.roomID,
      });
    });

    zim.on("callInvitationCancelled", (_zim, data) => {
      this.emitInviteCancelled(data.callID);
      logger.info("Call invitation cancelled", { callID: data.callID });
    });

    zim.on("callInvitationEnded", (_zim, data) => {
      this.emitInviteEnded({
        callID: data.callID,
        extendedData: data.extendedData ?? "",
        operatedUserID: data.operatedUserID,
      });
      logger.info("Call invitation ended", {
        callID: data.callID,
        extendedData: data.extendedData,
        operatedUserID: data.operatedUserID,
      });
    });

    zim.on("callInvitationTimeout", (_zim, data) => {
      this.emitInviteTimeout(data.callID);
      logger.info("Call invitation timed out", { callID: data.callID });
    });
  }
}

export const zegoCallInviteService = new ZegoCallInviteService();
