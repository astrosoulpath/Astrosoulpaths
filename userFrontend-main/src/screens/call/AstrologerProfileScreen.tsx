import React from "react";
import { ScrollView, Text, View } from "react-native";

import CustomButton from "@/src/components/CustomButton";
import { AstrologerProfile } from "@/src/types/zego";

type AstrologerProfileScreenProps = {
  astrologer: AstrologerProfile;
  isBusy: boolean;
  onCallPress: () => void;
};

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 14,
      }}
    >
      <Text
        style={{
          color: "rgba(214,215,236,0.58)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: "#F8FAFC", fontSize: 14, fontWeight: "600" }}>
        {value}
      </Text>
    </View>
  );
}

export default function AstrologerProfileScreen({
  astrologer,
  isBusy,
  onCallPress,
}: AstrologerProfileScreenProps) {
  return (
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
          Astrology Audio Call
        </Text>
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 30,
            fontWeight: "800",
            lineHeight: 36,
          }}
        >
          Astrologer Profile
        </Text>
        <Text
          style={{
            color: "rgba(214,215,236,0.68)",
            fontSize: 14,
            lineHeight: 22,
            marginTop: 10,
          }}
        >
          This is the fixed user-side test profile. Press the button to log in
          with `user_1`, invite `astro_1`, and join the ZEGO room.
        </Text>
      </View>

      <View
        style={{
          borderRadius: 28,
          borderWidth: 1,
          borderColor: "rgba(244,197,109,0.16)",
          backgroundColor: "rgba(12,18,56,0.94)",
          padding: 20,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "rgba(244,197,109,0.16)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: "#F4C56D", fontSize: 24, fontWeight: "800" }}
          >
            AK
          </Text>
        </View>

        <Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "800" }}>
          {astrologer.name}
        </Text>
        <Text
          style={{
            color: "rgba(214,215,236,0.72)",
            fontSize: 14,
            lineHeight: 22,
            marginTop: 8,
          }}
        >
          {astrologer.about}
        </Text>

        <View style={{ gap: 12, marginTop: 18 }}>
          <ProfileItem label="Specialty" value={astrologer.specialty} />
          <ProfileItem label="Experience" value={astrologer.experience} />
          <ProfileItem label="Languages" value={astrologer.languages} />
          <ProfileItem label="Rating" value={astrologer.rating} />
          <ProfileItem label="Astrologer ID" value={astrologer.userID} />
        </View>

        <View style={{ marginTop: 18 }}>
          <CustomButton
            label="Call Astrologer"
            loading={isBusy}
            onPress={onCallPress}
          />
        </View>
      </View>
    </ScrollView>
  );
}