import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CallLogList } from "@/src/components/audio-call/call-log-list";
import { CallStageCard } from "@/src/components/audio-call/call-stage-card";
import { AppContainer } from "@/src/components/common/app-container";
import {
  ASTROLOGER_USER_ID,
  CALLER_ID,
  ROOM_ID,
} from "@/src/constants/audio-call";
import { astroColors } from "@/src/constants/colors";
import { useAudioCall } from "@/src/hooks/use-audio-call";

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  );
}

export function AstrologerAudioCallScreen() {
  const {
    acceptCall,
    activeCall,
    connectionState,
    endCall,
    errorMessage,
    incomingInvite,
    isMicMuted,
    isReady,
    logs,
    remoteParticipantCount,
    rejectCall,
    roomState,
    simulateIncomingCall,
    speakerEnabled,
    speakerRoute,
    stage,
    statusCopy,
    toggleMicrophone,
    toggleSpeaker,
  } = useAudioCall();

  return (
    <AppContainer>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Astrologer Side</Text>
          <Text style={styles.title}>ZEGO audio accept flow</Text>
          <Text style={styles.subtitle}>{statusCopy}</Text>
        </View>

        <View style={styles.heroMeta}>
          <InfoRow label="Astrologer ID" value={ASTROLOGER_USER_ID} />
          <InfoRow label="Expected caller" value={CALLER_ID} />
          <InfoRow label="Default room" value={ROOM_ID} />
          <InfoRow label="ZIM state" value={connectionState} />
          <InfoRow label="Room state" value={roomState} />
          <InfoRow label="Ready" value={isReady ? "Yes" : "No"} />
        </View>

        {stage === "booting" || stage === "waiting" ? (
          <CallStageCard
            accent="#38BDF8"
            actions={[
              {
                label: "Simulate local invite",
                onPress: simulateIncomingCall,
                tone: "secondary",
              },
            ]}
            description="This screen stays online as astro_1, listens for ZIM call invitations, and waits for the user to invite the astrologer into a ZEGO room."
            eyebrow="Waiting Screen"
            footer="For a real call, the caller app should send a ZIM call invite with room details in extendedData. The button is only for local UI verification."
            title="Listening for incoming audio calls"
          />
        ) : null}

        {stage === "incoming" && incomingInvite ? (
          <CallStageCard
            accent="#F59E0B"
            actions={[
              { label: "Reject", onPress: rejectCall, tone: "secondary" },
              { label: "Accept", onPress: acceptCall, tone: "primary" },
            ]}
            description={`${incomingInvite.callerName} is calling. Accepting will acknowledge the ZIM invitation, then log astro_1 into the ZEGO voice room and start audio immediately.`}
            eyebrow="Incoming Call"
            footer="This is the key astrologer-side transition: invite received, accept pressed, room join started."
            title="Incoming audio session"
          >
            <View style={styles.infoBlock}>
              <InfoRow label="Call ID" value={incomingInvite.callID} />
              <InfoRow label="Caller" value={incomingInvite.callerID} />
              <InfoRow label="Room" value={incomingInvite.roomID} />
            </View>
          </CallStageCard>
        ) : null}

        {stage === "connecting" || stage === "reconnecting" ? (
          <CallStageCard
            accent="#A78BFA"
            description={
              stage === "reconnecting"
                ? "The app is restoring the ZEGO room connection, audio route, and remote playback after a network or app lifecycle interruption."
                : "The app is accepting the ZIM invitation, requesting microphone access if needed, and publishing astrologer audio into the ZEGO room."
            }
            eyebrow={stage === "reconnecting" ? "Reconnecting" : "Connecting"}
            title={stage === "reconnecting" ? "Recovering voice room" : "Joining voice room"}
          >
            <View style={styles.infoBlock}>
              <InfoRow
                label="Remote listeners"
                value={remoteParticipantCount}
              />
              <InfoRow label="Speaker route" value={speakerRoute} />
            </View>
          </CallStageCard>
        ) : null}

        {stage === "in-call" && activeCall ? (
          <CallStageCard
            accent="#22C55E"
            actions={[
              {
                label: isMicMuted ? "Unmute mic" : "Mute mic",
                onPress: toggleMicrophone,
                tone: "secondary",
              },
              {
                label: speakerEnabled ? "Use earpiece" : "Use speaker",
                onPress: toggleSpeaker,
                tone: "secondary",
              },
              { label: "End call", onPress: endCall, tone: "danger" },
            ]}
            description="The astrologer has accepted the invitation, joined the ZEGO room, and is now talking with the user through the published local audio stream and any discovered remote audio stream."
            eyebrow="Ongoing Call"
            footer="This flow intentionally stays small: receive invite, accept, join room, talk."
            title="Audio session live"
          >
            <View style={styles.infoBlock}>
              <InfoRow label="Caller" value={activeCall.callerName} />
              <InfoRow label="Room" value={activeCall.roomID} />
              <InfoRow label="Remote streams" value={remoteParticipantCount} />
              <InfoRow
                label="Microphone"
                value={isMicMuted ? "Muted" : "Live"}
              />
              <InfoRow
                label="Output"
                value={speakerEnabled ? "Speaker" : "Earpiece"}
              />
            </View>
          </CallStageCard>
        ) : null}

        {stage === "error" ? (
          <CallStageCard
            accent="#EF4444"
            actions={[
              {
                label: "Simulate local invite",
                onPress: simulateIncomingCall,
                tone: "secondary",
              },
            ]}
            description={errorMessage ?? "An unknown ZEGO error occurred."}
            eyebrow="Error"
            title="Call flow needs attention"
          />
        ) : null}

        <CallLogList logs={logs} />
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
    marginTop: 6,
  },
  heroMeta: {
    backgroundColor: "rgba(8, 16, 40, 0.76)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  infoBlock: {
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    gap: 10,
    marginTop: 18,
    paddingTop: 16,
  },
  infoLabel: {
    color: astroColors.muted,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoValue: {
    color: astroColors.white,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 12,
    textAlign: "right",
  },
  kicker: {
    color: astroColors.goldBright,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  subtitle: {
    color: astroColors.muted,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 540,
  },
  title: {
    color: astroColors.white,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
});
