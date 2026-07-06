export const ASTROLOGER_USER_ID = "astro_1";
export const ASTROLOGER_USER_NAME = "Astrologer One";
export const CALLER_ID = "user_1";
export const CALLER_NAME = "User One";
export const ROOM_ID = "astro_test_room";

export function getLocalStreamID(
  userID: string,
  roomID: string,
  callID?: string,
) {
  const safeCallID = callID?.trim();
  const callSuffix = safeCallID ? `_${safeCallID}` : "";

  return `${userID}_${roomID}${callSuffix}_audio`;
}
