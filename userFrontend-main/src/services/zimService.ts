import ZIM, {
  ZIMCallInvitationMode,
  ZIMCallUserState,
  ZIMConnectionState,
} from "zego-zim-react-native";

import { ASTROLOGER_ID, USER_ID } from "@/src/constants/astrologyCall";
import { ZEGO_APP_ID, ZEGO_APP_SIGN } from "@/src/constants/zegoConfig";
import { IncomingCallInvitation, ZimListenerCallbacks } from "@/src/types/zego";

function logZim(message: string, payload?: Record<string, unknown>) {
  if (payload) {
    console.log(`[ZIM] ${message}`, payload);
    return;
  }

  console.log(`[ZIM] ${message}`);
}

type InviteAstrologerParams = {
  roomID: string;
  callerID: string;
  calleeID: string;
};

function buildCallExtendedData({
  roomID,
  callerID,
  calleeID,
}: InviteAstrologerParams) {
  return JSON.stringify({
    roomID,
    callerID,
    calleeID,
    callType: "astrology_audio_call",
  });
}

function parseInvitationExtendedData(extendedData: string) {
  if (!extendedData) {
    return null;
  }

  try {
    return JSON.parse(extendedData) as {
      roomID?: string;
      callerID?: string;
      calleeID?: string;
      callType?: string;
    };
  } catch {
    return null;
  }
}

class ZimService {
  private zim: ZIM | null = null;
  private listenerCallbacks = new Map<number, ZimListenerCallbacks>();
  private nextListenerID = 1;
  private hasBoundListeners = false;
  private currentUserID: string | null = null;
  private connectionState = ZIMConnectionState.Disconnected;

  async initialize() {
    if (!this.zim) {
      const instance = ZIM.create({
        appID: ZEGO_APP_ID,
        appSign: ZEGO_APP_SIGN,
      });

      if (!instance) {
        throw new Error(
          "Unable to create ZIM instance. The native ZIM module is not available in the installed app. Use an Android/iOS development build, not Expo Go, and rebuild the client after native dependency changes.",
        );
      }

      this.zim = instance;
      this.bindListeners(instance);

      logZim("ZIM initialized", {
        appID: ZEGO_APP_ID,
      });
    }

    return this.zim;
  }

  async addListeners(callbacks: ZimListenerCallbacks) {
    await this.initialize();

    const listenerID = this.nextListenerID++;
    this.listenerCallbacks.set(listenerID, callbacks);

    logZim("Registered JS listener set", {
      listenerID,
      totalListeners: this.listenerCallbacks.size,
    });

    return () => {
      this.listenerCallbacks.delete(listenerID);
      logZim("Removed JS listener set", {
        listenerID,
        totalListeners: this.listenerCallbacks.size,
      });
    };
  }

  async login(userID: string) {
    const zim = await this.initialize();

    if (
      this.currentUserID === userID &&
      this.connectionState === ZIMConnectionState.Connected
    ) {
      logZim("Skipping duplicate login", { userID });
      return;
    }

    logZim("Calling ZIM login", { userID });
    await zim.login(userID, {
      userName: userID,
      token: "",
      isOfflineLogin: false,
      customStatus: "ready_for_audio_call",
    });

    this.currentUserID = userID;
    logZim("ZIM login resolved", { userID });
  }

  async inviteAstrologer({ roomID, callerID, calleeID }: InviteAstrologerParams) {
    const zim = await this.initialize();

    logZim("Sending call invitation", {
      callerID,
      inviteeID: calleeID,
      roomID,
    });

    const result = await zim.callInvite([calleeID], {
      timeout: 60,
      mode: ZIMCallInvitationMode.Advanced,
      extendedData: buildCallExtendedData({ roomID, callerID, calleeID }),
      enableNotReceivedCheck: true,
    });

    logZim("Call invitation sent", {
      callID: result.callID,
      errorUserList: result.errorUserList,
    });

    return result.callID;
  }

  async cancelInvitation(callID: string) {
    const zim = await this.initialize();

    logZim("Cancelling invitation", { callID, inviteeID: ASTROLOGER_ID });
    await zim.callCancel([ASTROLOGER_ID], callID, {
      extendedData: JSON.stringify({ reason: "caller_cancelled" }),
    });
  }

  async endAcceptedCall(callID: string) {
    const zim = await this.initialize();

    logZim("Ending accepted call", { callID });
    await zim.callEnd(callID, {
      extendedData: JSON.stringify({ reason: "caller_ended_call" }),
    });
  }

  async acceptInvitation(callID: string, extendedData = "") {
    const zim = await this.initialize();

    logZim("Accepting invitation", { callID });
    await zim.callAccept(callID, { extendedData });
  }

  async rejectInvitation(callID: string, extendedData = "") {
    const zim = await this.initialize();

    logZim("Rejecting invitation", { callID });
    await zim.callReject(callID, { extendedData });
  }

  async logout() {
    if (!this.zim || !this.currentUserID) {
      return;
    }

    logZim("Logging out from ZIM", { userID: this.currentUserID });
    this.zim.logout();
    this.currentUserID = null;
    this.connectionState = ZIMConnectionState.Disconnected;
  }

  async destroy() {
    if (!this.zim) {
      return;
    }

    await this.logout();

    logZim("Destroying ZIM instance");
    this.zim.destroy();
    this.zim = null;
    this.hasBoundListeners = false;
    this.listenerCallbacks.clear();
  }

  private bindListeners(zim: ZIM) {
    if (this.hasBoundListeners) {
      return;
    }

    zim.on("connectionStateChanged", (_zim, data) => {
      this.connectionState = data.state;
      logZim("connectionStateChanged", {
        state: data.state,
        event: data.event,
        extendedData: data.extendedData,
      });
      this.emitToListeners((callbacks) => {
        callbacks.onConnectionStateChanged?.(
          data.state,
          data.event,
          data.extendedData,
        );
      });
    });

    zim.on("callInvitationCreated", (_zim, data) => {
      logZim("callInvitationCreated", {
        callID: data.callID,
        caller: data.caller,
        invitees: data.callUserList.map((user) => user.userID),
      });
      this.emitToListeners((callbacks) => {
        callbacks.onCallInvitationCreated?.(data.callID);
      });
    });

    zim.on("callInvitationReceived", (_zim, data) => {
      const parsedData = parseInvitationExtendedData(data.extendedData);
      const invitation: IncomingCallInvitation = {
        callID: data.callID,
        callerID: parsedData?.callerID ?? data.caller,
        inviterID: data.inviter,
        roomID: parsedData?.roomID ?? null,
        extendedData: data.extendedData,
        timeout: data.timeout,
      };

      logZim("callInvitationReceived", {
        callID: invitation.callID,
        callerID: invitation.callerID,
        inviterID: invitation.inviterID,
        roomID: invitation.roomID,
        timeout: invitation.timeout,
      });

      this.emitToListeners((callbacks) => {
        callbacks.onCallInvitationReceived?.(invitation);
      });
    });

    zim.on("callUserStateChanged", (_zim, data) => {
      const astrologer = data.callUserList.find(
        (user) => user.userID === ASTROLOGER_ID,
      );

      logZim("callUserStateChanged", {
        callID: data.callID,
        astrologerState: astrologer?.state,
        fullCallUserList: data.callUserList.map((user) => ({
          userID: user.userID,
          state: user.state,
        })),
      });

      this.emitToListeners((callbacks) => {
        callbacks.onCallUserStateChanged?.(data.callID, data.callUserList);
      });
    });

    zim.on("callInvitationTimeout", (_zim, data) => {
      logZim("callInvitationTimeout", {
        callID: data.callID,
        mode: data.mode,
      });
      this.emitToListeners((callbacks) => {
        callbacks.onCallInvitationTimeout?.(data.callID);
      });
    });

    zim.on("callInvitationEnded", (_zim, data) => {
      logZim("callInvitationEnded", {
        callID: data.callID,
        caller: data.caller,
        operatedUserID: data.operatedUserID,
        extendedData: data.extendedData,
      });
      this.emitToListeners((callbacks) => {
        callbacks.onCallInvitationEnded?.(data.callID, data.extendedData);
      });
    });

    zim.on("error", (_zim, errorInfo) => {
      logZim("error", {
        code: errorInfo.code,
        message: errorInfo.message,
      });
      this.emitToListeners((callbacks) => {
        callbacks.onError?.(errorInfo.code, errorInfo.message);
      });
    });

    this.hasBoundListeners = true;
  }

  private emitToListeners(emit: (callbacks: ZimListenerCallbacks) => void) {
    for (const callbacks of this.listenerCallbacks.values()) {
      emit(callbacks);
    }
  }
}

export const zimService = new ZimService();
export { ZIMCallUserState, ZIMConnectionState };
