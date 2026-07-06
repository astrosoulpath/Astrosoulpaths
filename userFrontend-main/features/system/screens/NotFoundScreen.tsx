import AuthGlassCard from "@/components/auth/glass";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Compass, Sparkles } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.screen}>
        <LinearGradient
          colors={[
            "rgba(110,95,189,0.30)",
            "rgba(110,95,189,0.10)",
            "rgba(6,10,28,0)",
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.topGlow}
        />

        <LinearGradient
          colors={[
            "rgba(232,193,126,0.16)",
            "rgba(232,193,126,0.05)",
            "rgba(6,10,28,0)",
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomGlow}
        />

        <View style={styles.cardWrap}>
          <AuthGlassCard
            size="md"
            radius="xl"
            elevation="high"
            floatingBadge={
              <Compass size={18} color="#F4C56D" strokeWidth={2.2} />
            }
            floatingBadgeSize={58}
            floatingBadgeOffsetY={-29}
            title="Route Not Found"
            subtitle="This screen drifted off the star map. The path you asked for does not exist in the app."
            titleClassName="text-center text-[25px] font-bold leading-[31px] text-[#F4F1FA]"
            subtitleClassName="mt-2 mb-5 text-center text-[13px] leading-[20px] text-[rgba(214,217,245,0.76)]"
            backgroundColor="rgba(20, 24, 58, 0.92)"
            borderGradientColors={[
              "rgba(232,193,126,0.92)",
              "rgba(110,95,189,0.48)",
            ]}
            surfaceGradientColors={[
              "rgba(68, 69, 130, 0.22)",
              "rgba(35, 35, 92, 0.14)",
              "rgba(19, 22, 67, 0.86)",
            ]}
            overlayGradientColors={[
              "rgba(255,255,255,0.08)",
              "rgba(255,255,255,0.02)",
              "rgba(228,185,106,0.06)",
            ]}
          >
            <VStack className="gap-5">
              <View style={styles.logoWrap}>
                <LinearGradient
                  colors={[
                    "rgba(232,193,126,0.28)",
                    "rgba(110,95,189,0.20)",
                    "rgba(255,255,255,0.04)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoRing}
                >
                  <View style={styles.logoCore}>
                    <Sparkles size={18} color="#F4C56D" strokeWidth={2.1} />
                    <Text style={styles.logoText}>404</Text>
                    <Text style={styles.logoSubtext}>Lost In Orbit</Text>
                  </View>
                </LinearGradient>
              </View>

              <Text style={styles.helperText}>
                Check the route name, or jump back to a known screen from here.
              </Text>

              <VStack className="gap-3">
                <Pressable
                  onPress={() => router.replace("/" as never)}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Go To App Start</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.replace("/dev-nav" as never)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    Open Dev Navigation
                  </Text>
                </Pressable>
              </VStack>
            </VStack>
          </AuthGlassCard>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#060A1C",
  },
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#060A1C",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: -20,
    right: -20,
    height: 260,
  },
  bottomGlow: {
    position: "absolute",
    bottom: 0,
    left: -20,
    right: -20,
    height: 220,
  },
  cardWrap: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 390,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 2,
  },
  logoRing: {
    width: 174,
    height: 174,
    borderRadius: 87,
    padding: 1.2,
  },
  logoCore: {
    flex: 1,
    borderRadius: 86,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12, 16, 44, 0.90)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  logoText: {
    marginTop: 10,
    color: "#F8E6BE",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  logoSubtext: {
    marginTop: 4,
    color: "rgba(214,217,245,0.74)",
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  helperText: {
    color: "rgba(214,217,245,0.62)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryButton: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(232,193,126,0.34)",
    backgroundColor: "rgba(232,193,126,0.14)",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#F4F1FA",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#DDE0F4",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
