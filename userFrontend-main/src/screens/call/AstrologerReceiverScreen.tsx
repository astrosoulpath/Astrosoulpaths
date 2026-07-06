import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "@/src/components/CustomButton";
import { ASTROLOGER_ID } from "@/src/constants/astrologyCall";
import { useAstrologerReceiverAudio } from "@/src/hooks/useAstrologerReceiverAudio";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: "rgba(214,215,236,0.68)", fontSize: 13 }}>
        {label}
      </Text>
      <Text
        style={{
          color: "#F8FAFC",
          fontSize: 13,
          fontWeight: "600",
          flexShrink: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function AstrologerReceiverScreen() {
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
    endCall,
    toggleMicrophone,
  } = useAstrologerReceiverAudio();

  const isBusy = phase === "accepting" || phase === "joining-room" || phase === "ending";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070D2B" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: 24, paddingBottom: 24 }}>
          <Text
            style={{
              color: "#F4C56D",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 2.4,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Astrologer Receiver
          </Text>
          <Text
            style={{
              color: "#F8FAFC",
              fontSize: 30,
              fontWeight: "800",
              lineHeight: 36,
            }}
          >
            Listening as {ASTROLOGER_ID}
          </Text>
          <Text
            style={{
              color: "rgba(214,215,236,0.68)",
              fontSize: 14,
              lineHeight: 22,
              marginTop: 10,
            }}
          >
            Open this screen on the astrologer device. It logs in as {ASTROLOGER_ID},
            auto-accepts incoming ZIM invites, joins the room from invite extendedData,
            publishes the astrologer microphone, and plays the caller stream.
          </Text>
        </View>

        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(244,197,109,0.16)",
            backgroundColor: "rgba(12,18,56,0.94)",
            padding: 18,
          }}
        >
          <View
            style={{
              borderRadius: 16,
              backgroundColor: "rgba(244,197,109,0.08)",
              padding: 14,
            }}
          >
            <Text style={{ color: "#F6E7B1", fontSize: 13, lineHeight: 20 }}>
              {statusMessage}
            </Text>
          </View>

          {error ? (
            <View
              style={{
                marginTop: 12,
                borderRadius: 16,
                backgroundColor: "rgba(127,29,29,0.42)",
                borderWidth: 1,
                borderColor: "rgba(248,113,113,0.25)",
                padding: 14,
              }}
            >
              <Text style={{ color: "#FCA5A5", fontSize: 13, lineHeight: 20 }}>
                {error}
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <InfoRow label="Phase" value={phase} />
            <InfoRow label="RTC connection" value={rtcConnectionState} />
            <InfoRow label="ZIM connection" value={zimConnectionState} />
            <InfoRow label="Caller" value={callerID ?? "Waiting for invite"} />
            <InfoRow label="Call ID" value={currentCallID ?? "Not received yet"} />
            <InfoRow label="Room ID" value={activeRoomID ?? "Not joined"} />
            <InfoRow
              label="Local stream"
              value={localStreamID ?? "Not publishing"}
            />
            <InfoRow label="Microphone" value={isMicMuted ? "Muted" : "Live"} />
            <InfoRow label="Remote streams" value={String(remoteStreams.length)} />
          </View>
        </View>

        <View
          style={{
            marginTop: 18,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.12)",
            backgroundColor: "rgba(8,14,43,0.88)",
            padding: 18,
          }}
        >
          <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "700" }}>
            Caller audio state
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            {remoteStreams.length === 0 ? (
              <Text style={{ color: "rgba(214,215,236,0.62)", fontSize: 13 }}>
                No caller stream is playing yet. This usually means the caller has not
                published yet or is not in the same room.
              </Text>
            ) : (
              remoteStreams.map((stream) => (
                <View
                  key={stream.streamID}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(244,197,109,0.16)",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    padding: 14,
                  }}
                >
                  <Text
                    style={{
                      color: "#F8FAFC",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {stream.userName || stream.userID}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(214,215,236,0.62)",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Stream: {stream.streamID}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
          <View style={{ flex: 1 }}>
            <CustomButton
              label={isMicMuted ? "Unmute Mic" : "Mute Mic"}
              variant="secondary"
              disabled={isBusy || !activeRoomID}
              onPress={() => {
                void toggleMicrophone();
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <CustomButton
              label="End Call"
              variant="danger"
              disabled={isBusy}
              onPress={() => {
                void endCall();
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}