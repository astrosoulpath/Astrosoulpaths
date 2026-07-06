/**
 * DEV NAVIGATION HUB
 * Tap any route to preview it directly.
 * Keep this off the root index so the app can follow the real auth startup flow.
 */
import { appRoutes } from "@/src/navigation/routes";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RouteItem = {
  label: string;
  description: string;
  route: string;
  tag?: "AUTH" | "APP" | "FEATURE" | "TAB";
};

const ROUTES: RouteItem[] = [
  {
    label: "Route Explorer",
    description: "Startup screen that lists every app route",
    route: appRoutes.devNav,
    tag: "APP",
  },
  {
    label: "Root Redirect",
    description: "App entry route that now opens the route explorer",
    route: "/",
    tag: "APP",
  },
  {
    label: "Send OTP",
    description: "Phone number entry + country picker",
    route: "/(auth)/otp-login",
    tag: "AUTH",
  },
  {
    label: "Verify OTP",
    description: "6-digit PinInput verification screen",
    route: "/(auth)/verify-otp",
    tag: "AUTH",
  },
  {
    label: "Onboarding User",
    description: "New user onboarding preview flow",
    route: "/(auth)/onboarding",
    tag: "AUTH",
  },
  {
    label: "Home Dashboard",
    description: "Feature cards + bottom nav",
    route: appRoutes.home,
    tag: "APP",
  },
  {
    label: "Vedic Astrology",
    description: "Birth chart & planetary insights",
    route: "/vedic/page",
    tag: "FEATURE",
  },
  {
    label: "Kundli Hub (Direct)",
    description: "New Kundli + Open Kundli premium screen",
    route: appRoutes.kundli,
    tag: "FEATURE",
  },
  {
    label: "Recharge",
    description: "Amount input + create-order backend call",
    route: "/recharge",
    tag: "FEATURE",
  },
  {
    label: "Simple Audio Call",
    description: "ZEGO mic-only room join test for two devices",
    route: "/audio-call",
    tag: "FEATURE",
  },
  {
    label: "Astrologer Receiver Call",
    description: "Auto-accept incoming call and publish as astro_1",
    route: "/dev/astrologer-call",
    tag: "FEATURE",
  },
  {
    label: "Coming Soon",
    description: "Feature placeholder page preview",
    route: appRoutes.comingSoon,
    tag: "FEATURE",
  },
  {
    label: "Reconciliation Test",
    description: "DEV-only manual payment reconciliation screen",
    route: "/dev/reconcile-test",
    tag: "FEATURE",
  },
  {
    label: "Kundli",
    description: "Kundli tab route",
    route: appRoutes.kundli,
    tag: "TAB",
  },
  {
    label: "Insights",
    description: "Tab placeholder route",
    route: appRoutes.insights,
    tag: "TAB",
  },
  {
    label: "Remedies",
    description: "Tab placeholder route",
    route: appRoutes.remedies,
    tag: "TAB",
  },
  {
    label: "Profile",
    description: "Tab placeholder route",
    route: appRoutes.profile,
    tag: "TAB",
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  AUTH: { bg: "rgba(99,102,241,0.22)", text: "#a5b4fc" },
  APP: { bg: "rgba(244,197,109,0.18)", text: "#F4C56D" },
  FEATURE: { bg: "rgba(52,211,153,0.18)", text: "#6ee7b7" },
  TAB: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
};

export default function DevNavScreen() {
  const router = useRouter();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#080e37" }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#080e37" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <View style={{ paddingTop: 28, paddingBottom: 8 }}>
          <Text
            style={{
              color: "#F4C56D",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 2.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Route Explorer
          </Text>
          <Text
            style={{
              color: "#F1F2FA",
              fontSize: 26,
              fontWeight: "800",
              letterSpacing: 0.3,
            }}
          >
            All App Routes
          </Text>
          <Text
            style={{
              color: "rgba(214,215,236,0.55)",
              fontSize: 12,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            Tap any row to open that page. This screen is now the first page
            shown when the app launches.
          </Text>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: "rgba(232,193,126,0.15)",
            marginVertical: 16,
          }}
        />

        {ROUTES.map((item, idx) => {
          const tagStyle = item.tag ? TAG_COLORS[item.tag] : undefined;

          return (
            <Pressable
              key={`${item.route}-${item.label}`}
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: pressed
                  ? "rgba(232,193,126,0.08)"
                  : "rgba(24,26,72,0.72)",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(232,193,126,0.18)",
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 10,
              })}
            >
              <Text
                style={{
                  color: "rgba(244,197,109,0.45)",
                  fontSize: 12,
                  fontWeight: "700",
                  width: 24,
                  marginRight: 4,
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </Text>

              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <Text
                    style={{
                      color: "#F1F2FA",
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    {item.label}
                  </Text>
                  {tagStyle ? (
                    <View
                      style={{
                        backgroundColor: tagStyle.bg,
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          color: tagStyle.text,
                          fontSize: 9,
                          fontWeight: "700",
                          letterSpacing: 1.2,
                        }}
                      >
                        {item.tag}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{
                    color: "rgba(214,215,236,0.52)",
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  {item.description}
                </Text>
                <Text
                  style={{
                    color: "rgba(165,180,252,0.45)",
                    fontSize: 10,
                    marginTop: 3,
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  }}
                >
                  {item.route}
                </Text>
              </View>

              <ChevronRight size={16} color="rgba(232,193,126,0.45)" />
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => router.push("/dev/reconcile-test" as never)}
          style={({ pressed }) => ({
            marginTop: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(52,211,153,0.22)",
            backgroundColor: pressed
              ? "rgba(52,211,153,0.16)"
              : "rgba(17,24,39,0.92)",
            paddingHorizontal: 16,
            paddingVertical: 16,
          })}
        >
          <Text
            style={{
              color: "#6ee7b7",
              fontSize: 15,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Open Reconciliation Test
          </Text>
          <Text
            style={{
              color: "rgba(214,215,236,0.62)",
              fontSize: 12,
              lineHeight: 17,
            }}
          >
            DEV-only payment reconciliation helper. Remove before release.
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
