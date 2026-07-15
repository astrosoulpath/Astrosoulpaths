export declare const ZEGO_APP_ID: number;
export declare const ZEGO_APP_SIGN: string;
export declare const ZEGO_SCENARIO: number;

export declare function sanitizeZegoID(
  value: string,
): string;

export declare function buildStreamID(
  roomID: string,
  userID: string,
): string;

export declare function buildRoomID(
  callerID: string,
  calleeID: string,
): string;

export declare function hasValidZegoConfig(): boolean;