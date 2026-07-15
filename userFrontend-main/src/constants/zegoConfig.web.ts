import Constants from "expo-constants";

type ZegoExtraConfig = {
  appId?: number | string;
  appSign?: string;
};

const zegoExtra = (
  Constants.expoConfig?.extra?.zego ?? {}
) as ZegoExtraConfig;

export const ZEGO_APP_ID = Number(
  zegoExtra.appId ?? 0,
);

export const ZEGO_APP_SIGN = String(
  zegoExtra.appSign ?? "",
);

/**
 * Web fallback only.
 * Native ZEGO SDK is not loaded in the browser.
 */
export const ZEGO_SCENARIO = 0;

const INVALID_ZEGO_ID_CHARACTERS =
  /[^A-Za-z0-9_-]/g;

export function sanitizeZegoID(
  value: string,
): string {
  return value
    .trim()
    .replace(
      INVALID_ZEGO_ID_CHARACTERS,
      "_",
    );
}

export function buildStreamID(
  roomID: string,
  userID: string,
): string {
  return `audio_${sanitizeZegoID(
    roomID,
  )}_${sanitizeZegoID(userID)}`.slice(
    0,
    256,
  );
}

export function buildRoomID(
  callerID: string,
  calleeID: string,
): string {
  const timestamp =
    Date.now().toString(36);

  const randomSuffix =
    Math.random()
      .toString(36)
      .slice(2, 8);

  return `audio_room_${sanitizeZegoID(
    callerID,
  )}_${sanitizeZegoID(
    calleeID,
  )}_${timestamp}_${randomSuffix}`.slice(
    0,
    128,
  );
}

export function hasValidZegoConfig(): boolean {
  return (
    Number.isFinite(ZEGO_APP_ID) &&
    ZEGO_APP_ID > 0 &&
    ZEGO_APP_SIGN.length > 0
  );
}