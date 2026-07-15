import type { ZIM as ZIMInstance } from "zego-zim-web";

import { getZegoConfig } from "@/src/features/calls/config/zego.config";
import { createLogger } from "@/src/lib/logger";
import {
  buildAcceptExtendedData,
  buildQuitExtendedData,
  buildRejectExtendedData,
  parseAudioCallInvitation,
} from "@/src/utils/audio-call-invitation";

const logger = createLogger("ZegoCallInviteServiceWeb");

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

export type CallInviteListener = {
  onConnectionStateChange?: (stateLabel: string) => void;
  onIncomingInvite?: (invite: IncomingCallInvite) => void;
  onInviteCancelled?: (callID: string) => void;
  onInviteEnded?: (event: CallInvitationEndedEvent) => void;
  onInviteTimeout?: (callID: string) => void;
  onReadyChange?: (ready: boolean) => void;
};

class ZegoCallInviteServiceWeb {
  private currentUserID: string | null = null;
  private initialized = false;
  private listeners = new Set<CallInviteListener>();
  private loggedIn = false;
  private zim: ZIMInstance | null = null;

  subscribe(listener: CallInviteListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async initialize(
  userID: string,
  userName: string,
): Promise<ZIMInstance> {
    if (this.loggedIn && this.currentUserID === userID && this.zim) {
      return this.zim;
    }

    const config = getZegoConfig();

    if (!this.zim) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof location === "undefined"
  ) {
    throw new Error(
      "ZEGO ZIM Web cannot initialize during SSR.",
    );
  }

  const { ZIM } = await import("zego-zim-web");

  this.zim =
    ZIM.getInstance() ??
    ZIM.create({
      appID: config.appID,
    });
}

    if (!this.zim) {
      throw new Error("Failed to create ZEGO ZIM web instance.");
    }

    if (!this.initialized) {
      this.registerHandlers(this.zim);
      this.initialized = true;
    }

    if (
      this.loggedIn &&
      this.currentUserID &&
      this.currentUserID !== userID
    ) {
      await this.zim.logout();

      this.loggedIn = false;
      this.currentUserID = null;
      this.emitReady(false);
    }

    await this.zim.login(userID, {
      userName,
      token: "",
      isOfflineLogin: false,
      customStatus: "available",
      customStatusDuration: 0,
    });

    this.currentUserID = userID;
    this.loggedIn = true;

    this.emitReady(true);

    logger.info("ZEGO ZIM web logged in", {
      userID,
    });

    return this.zim;
  }

  async acceptCall(callID: string, roomID: string): Promise<void> {
    const zim = this.ensureZim();

    await zim.callAccept(callID, {
      extendedData: buildAcceptExtendedData(roomID),
    });

    logger.info("Accepted web call invitation", {
      callID,
      roomID,
    });
  }

  async rejectCall(
    callID: string,
    reason = "declined",
  ): Promise<void> {
    const zim = this.ensureZim();

    await zim.callReject(callID, {
      extendedData: buildRejectExtendedData(reason),
    });

    logger.info("Rejected web call invitation", {
      callID,
      reason,
    });
  }

  async quitCall(callID: string, roomID: string): Promise<void> {
    const zim = this.ensureZim();

    await zim.callQuit(callID, {
      extendedData: buildQuitExtendedData(roomID),
    });

    logger.info("Quit web call invitation", {
      callID,
      roomID,
    });
  }

  async cleanup(): Promise<void> {
    const zim = this.zim;

    if (!zim) {
      this.resetState();
      return;
    }

    try {
      if (this.loggedIn) {
        await zim.logout();
      }
    } catch (error) {
      logger.warn("ZIM web logout failed", error);
    }

    try {
      zim.destroy();
    } catch (error) {
      logger.warn("ZIM web destroy failed", error);
    }

    this.resetState();
  }

  private ensureZim(): ZIMInstance {
    if (!this.zim || !this.loggedIn) {
      throw new Error("ZEGO ZIM web is not initialized.");
    }

    return this.zim;
  }

  private resetState(): void {
    this.zim = null;
    this.initialized = false;
    this.loggedIn = false;
    this.currentUserID = null;

    this.emitReady(false);
  }

  private emitConnectionState(stateLabel: string): void {
    for (const listener of this.listeners) {
      listener.onConnectionStateChange?.(stateLabel);
    }
  }

  private emitIncomingInvite(invite: IncomingCallInvite): void {
    for (const listener of this.listeners) {
      listener.onIncomingInvite?.(invite);
    }
  }

  private emitInviteCancelled(callID: string): void {
    for (const listener of this.listeners) {
      listener.onInviteCancelled?.(callID);
    }
  }

  private emitInviteEnded(event: CallInvitationEndedEvent): void {
    for (const listener of this.listeners) {
      listener.onInviteEnded?.(event);
    }
  }

  private emitInviteTimeout(callID: string): void {
    for (const listener of this.listeners) {
      listener.onInviteTimeout?.(callID);
    }
  }

  private emitReady(ready: boolean): void {
    for (const listener of this.listeners) {
      listener.onReadyChange?.(ready);
    }
  }

  private registerHandlers(zim: ZIMInstance): void {
    zim.on("connectionStateChanged", (_zim, data) => {
  const stateLabel = String(data.state);

  this.emitConnectionState(stateLabel);

  logger.info("ZIM web connection changed", {
    state: stateLabel,
    event: data.event,
    extendedData: data.extendedData,
  });
});

    zim.on("callInvitationReceived", (_zim, data) => {
      try {
        const parsed = parseAudioCallInvitation(data.extendedData);

        const invite: IncomingCallInvite = {
          callID: data.callID,
          callerID: parsed.callerID,
          callerName: parsed.callerName,
          inviterID: data.inviter,
          roomID: parsed.roomID,
          token: parsed.token,
          rawExtendedData: parsed.rawExtendedData,
          receivedAt: data.createTime,
        };

        this.emitIncomingInvite(invite);

        logger.info("Incoming web call invitation", {
          callID: invite.callID,
          callerID: invite.callerID,
          roomID: invite.roomID,
        });
      } catch (error) {
        logger.error(
          "Failed to parse web call invitation",
          error,
        );
      }
    });

    zim.on("callInvitationCancelled", (_zim, data) => {
      this.emitInviteCancelled(data.callID);

      logger.info("Web call invitation cancelled", {
        callID: data.callID,
      });
    });

    zim.on("callInvitationEnded", (_zim, data) => {
      this.emitInviteEnded({
        callID: data.callID,
        extendedData: data.extendedData ?? "",
        operatedUserID: data.operatedUserID,
      });

      logger.info("Web call invitation ended", {
        callID: data.callID,
      });
    });

    zim.on("callInvitationTimeout", (_zim, data) => {
      this.emitInviteTimeout(data.callID);

      logger.info("Web call invitation timed out", {
        callID: data.callID,
      });
    });
  }
}

export const zegoCallInviteService =
  new ZegoCallInviteServiceWeb();