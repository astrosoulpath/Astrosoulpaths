import React from "react";
import { useShallow } from "zustand/react/shallow";

import { astrologerReceiverController } from "@/src/services/astrologerReceiverController";
import { useAstrologerReceiverStore } from "@/src/store/astrologerReceiverStore";

export function useAstrologerReceiverAudio() {
  const {
    phase,
    rtcConnectionState,
    zimConnectionState,
    statusMessage,
    error,
    activeRoomID,
    localStreamID,
    currentCallID,
    callerID,
    remoteStreams,
    isMicMuted,
  } = useAstrologerReceiverStore(
    useShallow((state) => ({
      phase: state.phase,
      rtcConnectionState: state.rtcConnectionState,
      zimConnectionState: state.zimConnectionState,
      statusMessage: state.statusMessage,
      error: state.error,
      activeRoomID: state.activeRoomID,
      localStreamID: state.localStreamID,
      currentCallID: state.currentCallID,
      callerID: state.callerID,
      remoteStreams: state.remoteStreams,
      isMicMuted: state.isMicMuted,
    })),
  );

  React.useEffect(() => {
    void astrologerReceiverController.initialize();
  }, []);

  const endCall = React.useCallback(() => {
    return astrologerReceiverController.endCall();
  }, []);

  const toggleMicrophone = React.useCallback(() => {
    return astrologerReceiverController.toggleMicrophone();
  }, []);

  return {
    phase,
    rtcConnectionState,
    zimConnectionState,
    statusMessage,
    error,
    activeRoomID,
    localStreamID,
    currentCallID,
    callerID,
    remoteStreams,
    isMicMuted,
    endCall,
    toggleMicrophone,
  };
}