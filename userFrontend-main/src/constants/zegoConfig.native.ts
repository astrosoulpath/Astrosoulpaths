import Constants from "expo-constants";
import { ZegoScenario } from "zego-express-engine-reactnative";

type ZegoExtraConfig = {
  appId?: number | string;
  appSign?: string;
};

const zegoExtra = (Constants.expoConfig?.extra?.zego ?? {}) as ZegoExtraConfig;

export const ZEGO_APP_ID = Number(zegoExtra.appId ?? 746838843);
export const ZEGO_APP_SIGN = String(
  zegoExtra.appSign ??
    "7cfbf8ce8573c6ed2b7a5abcc72da909ed27bd7d1c3859a76db2ab977d3fa68a",
);
export const ZEGO_SCENARIO = ZegoScenario.StandardVoiceCall;

const INVALID_ZEGO_ID_CHARACTERS = /[^A-Za-z0-9_-]/g;

export function sanitizeZegoID(value: string) {
  return value.trim().replace(INVALID_ZEGO_ID_CHARACTERS, "_");
}

export function buildStreamID(roomID: string, userID: string) {
  return `audio_${sanitizeZegoID(roomID)}_${sanitizeZegoID(userID)}`.slice(
    0,
    256,
  );
}

export function buildRoomID(callerID: string, calleeID: string) {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).slice(2, 8);

  return `audio_room_${sanitizeZegoID(callerID)}_${sanitizeZegoID(calleeID)}_${timestamp}_${randomSuffix}`.slice(
    0,
    128,
  );
}

export function hasValidZegoConfig() {
  return (
    Number.isFinite(ZEGO_APP_ID) && ZEGO_APP_ID > 0 && ZEGO_APP_SIGN.length > 0
  );
}
