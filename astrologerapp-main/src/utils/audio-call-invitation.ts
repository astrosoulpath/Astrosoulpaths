import { CALLER_ID, CALLER_NAME, ROOM_ID } from "@/src/constants/audio-call";

export type AudioCallInvitationPayload = {
  callerID?: string;
  callerName?: string;
  roomID?: string;
  token?: string;
};

export type ParsedAudioCallInvitation = {
  callerID: string;
  callerName: string;
  roomID: string;
  token?: string;
  rawExtendedData: string;
};

export function parseAudioCallInvitation(
  extendedData: string,
): ParsedAudioCallInvitation {
  let parsed: AudioCallInvitationPayload = {};

  if (extendedData.trim().length > 0) {
    try {
      parsed = JSON.parse(extendedData) as AudioCallInvitationPayload;
    } catch {
      parsed = {};
    }
  }

  return {
    callerID: parsed.callerID ?? CALLER_ID,
    callerName: parsed.callerName ?? CALLER_NAME,
    roomID: parsed.roomID ?? ROOM_ID,
    token: parsed.token,
    rawExtendedData: extendedData,
  };
}

export function buildAcceptExtendedData(roomID: string) {
  return JSON.stringify({
    acceptedAt: Date.now(),
    roomID,
  });
}

export function buildRejectExtendedData(reason: string) {
  return JSON.stringify({
    reason,
    rejectedAt: Date.now(),
  });
}

export function buildQuitExtendedData(roomID: string) {
  return JSON.stringify({
    endedAt: Date.now(),
    roomID,
  });
}
