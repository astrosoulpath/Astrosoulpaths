import { useEffect, useMemo } from "react";

import { audioCallController } from "@/src/features/calls/services/audio-call-controller";
import { useAudioCallStore } from "@/src/features/calls/store/audio-call-store";

export function useAudioCall() {
  const activeCall = useAudioCallStore((state) => state.activeCall);
  const connectionState = useAudioCallStore((state) => state.connectionState);
  const errorMessage = useAudioCallStore((state) => state.errorMessage);
  const incomingInvite = useAudioCallStore((state) => state.incomingInvite);
  const isMicMuted = useAudioCallStore((state) => state.isMicMuted);
  const isReady = useAudioCallStore((state) => state.isReady);
  const logs = useAudioCallStore((state) => state.logs);
  const remoteParticipantCount = useAudioCallStore(
    (state) => state.remoteParticipantCount,
  );
  const roomState = useAudioCallStore((state) => state.roomState);
  const speakerEnabled = useAudioCallStore((state) => state.speakerEnabled);
  const speakerRoute = useAudioCallStore((state) => state.speakerRoute);
  const stage = useAudioCallStore((state) => state.stage);

  useEffect(() => {
    void audioCallController.start();
  }, []);

  const statusCopy = useMemo(() => {
    switch (stage) {
      case "booting":
        return "Signing in the astrologer account to ZIM";
      case "waiting":
        return "Waiting for the caller to send a ZEGO invitation";
      case "incoming":
        return "Incoming audio call ready to accept";
      case "connecting":
        return "Accepting invite and joining the ZEGO voice room";
      case "reconnecting":
        return "Recovering the ZEGO room connection and remote playback";
      case "in-call":
        return "Live audio conversation is active";
      case "error":
        return "The calling flow hit an error";
    }
  }, [stage]);

  return {
    acceptCall: () => void audioCallController.acceptCall(),
    activeCall,
    connectionState,
    endCall: () => void audioCallController.endCall(),
    errorMessage,
    incomingInvite,
    isMicMuted,
    isReady,
    logs,
    remoteParticipantCount,
    rejectCall: () => void audioCallController.rejectCall(),
    roomState,
    simulateIncomingCall: () => audioCallController.simulateIncomingCall(),
    speakerEnabled,
    speakerRoute,
    stage,
    statusCopy,
    toggleMicrophone: () => void audioCallController.toggleMicrophone(),
    toggleSpeaker: () => void audioCallController.toggleSpeaker(),
  };
}
