import React from "react";
import { useShallow } from "zustand/react/shallow";

import { audioCallController } from "../services/audioCallController";
import { useAudioCallStore } from "@/src/store/audioCallStore";

export function useAstrologerAudioCall() {
  const {
    phase,
    rtcConnectionState,
    zimConnectionState,
    invitationState,
    error,
    statusMessage,
    activeRoomID,
    localStreamID,
    currentCallID,
    remoteStreams,
    isMicMuted,
    isAstrologerAccepted,
  } = useAudioCallStore(
    useShallow((state) => ({
      phase: state.phase,
      rtcConnectionState: state.rtcConnectionState,
      zimConnectionState: state.zimConnectionState,
      invitationState: state.invitationState,
      error: state.error,
      statusMessage: state.statusMessage,
      activeRoomID: state.activeRoomID,
      localStreamID: state.localStreamID,
      currentCallID: state.currentCallID,
      remoteStreams: state.remoteStreams,
      isMicMuted: state.isMicMuted,
      isAstrologerAccepted: state.isAstrologerAccepted,
    })),
  );

  const startCall = React.useCallback(() => {
    return audioCallController.startCall();
  }, []);

  const endCall = React.useCallback(() => {
    return audioCallController.endCall();
  }, []);

  const toggleMicrophone = React.useCallback(() => {
    return audioCallController.toggleMicrophone();
  }, []);

  return {
    phase,
    rtcConnectionState,
    zimConnectionState,
    invitationState,
    error,
    statusMessage,
    activeRoomID,
    localStreamID,
    currentCallID,
    remoteStreams,
    isInRoom: Boolean(activeRoomID),
    isMicMuted,
    isAstrologerAccepted,
    startCall,
    endCall,
    toggleMicrophone,
  };
}