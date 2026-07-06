import React from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ASTROLOGER_PROFILE } from "@/src/constants/astrologyCall";
import { useAstrologerAudioCall } from "@/src/hooks/useZegoAudio";
import AstrologerProfileScreen from "@/src/screens/call/AstrologerProfileScreen";
import OngoingCallScreen from "@/src/screens/call/OngoingCallScreen";

export default function AudioCallScreen() {
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
    isInRoom,
    isMicMuted,
    isAstrologerAccepted,
    startCall,
    endCall,
    toggleMicrophone,
  } = useAstrologerAudioCall();

  const isBusy =
    phase === "initializing" ||
    phase === "requesting-permission" ||
    phase === "joining-room" ||
    phase === "inviting-astrologer" ||
    phase === "ending";

  const showOngoingScreen =
    isInRoom ||
    invitationState !== "idle" ||
    phase === "waiting-acceptance" ||
    phase === "in-call" ||
    phase === "error";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070D2B" }}>
      <StatusBar barStyle="light-content" backgroundColor="#070D2B" />
      <View style={{ flex: 1 }}>
        {showOngoingScreen ? (
          <OngoingCallScreen
            activeRoomID={activeRoomID}
            callID={currentCallID}
            error={error}
            invitationState={invitationState}
            isAstrologerAccepted={isAstrologerAccepted}
            isBusy={isBusy}
            isMicMuted={isMicMuted}
            localStreamID={localStreamID}
            phase={phase}
            remoteStreams={remoteStreams}
            rtcConnectionState={rtcConnectionState}
            statusMessage={statusMessage}
            zimConnectionState={zimConnectionState}
            onEndCall={() => {
              void endCall();
            }}
            onToggleMicrophone={() => {
              void toggleMicrophone();
            }}
          />
        ) : (
          <AstrologerProfileScreen
            astrologer={ASTROLOGER_PROFILE}
            isBusy={isBusy}
            onCallPress={() => {
              void startCall();
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
