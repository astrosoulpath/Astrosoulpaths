import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import {
  ArrowLeft,
  Hash,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Wand2,
} from "lucide-react-native";

import CustomFeatureCard from "@/components/custom/Cust_Card";

const features = [
  {
    title: "Kundli",
    description: "Your Natal Birth\nChart Analysis",
    icon: Sun,
    cardBg: "rgba(161, 28, 37, 0.58)",
    iconBg: "rgba(96, 18, 32, 0.72)",
    route: "/kundli",
  },
  {
    title: "Predictions",
    description: "Future Insights &\nAI Forecasts",
    icon: Sparkles,
    cardBg: "rgba(132, 22, 42, 0.56)",
    iconBg: "rgba(86, 18, 38, 0.72)",
    route: "/kundli",
  },
  {
    title: "Panchang",
    description: "Daily Hindu\nCalendar",
    icon: Star,
    cardBg: "rgba(119, 20, 45, 0.56)",
    iconBg: "rgba(77, 17, 43, 0.72)",
    route: "/kundli",
  },
  {
    title: "Year Varsh",
    description: "Annual Horoscope\nOverview",
    icon: Hash,
    cardBg: "rgba(109, 18, 50, 0.58)",
    iconBg: "rgba(72, 16, 48, 0.72)",
    route: "/kundli",
  },
  {
    title: "Match Making",
    description: "Kundli Matching for\nCompatibility",
    icon: UserRound,
    cardBg: "rgba(145, 25, 38, 0.54)",
    iconBg: "rgba(92, 18, 34, 0.72)",
    route: "/kundli",
  },
  {
    title: "Remedies",
    description: "Personalized Astro\nRemedies",
    icon: Wand2,
    cardBg: "rgba(122, 20, 35, 0.58)",
    iconBg: "rgba(80, 16, 31, 0.72)",
    route: "/kundli",
  },
];

const VedicAstrologyScreen = () => {
  const { width } = useWindowDimensions();
  const isTabletOrWeb = width >= 768;
  const horizontalPadding = width < 380 ? 14 : width < 768 ? 20 : 32;
  const rowGap = width < 380 ? 12 : 16;
  const contentWidth = Math.min(
    width - horizontalPadding * 2,
    isTabletOrWeb ? 560 : 360,
  );
  const cardWidth = Math.min(165, (contentWidth - rowGap) / 2);
  const cardHeight = width < 380 ? 236 : width < 768 ? 250 : 264;
  const titleSize = width < 380 ? 42 : width < 768 ? 52 : 68;
  const featureRows = [
    features.slice(0, 2),
    features.slice(2, 4),
    features.slice(4, 6),
  ];

  return (
    <SafeAreaView
      className="flex-1 bg-[#120205]"
      edges={["top", "left", "right"]}
    >
      <StatusBar style="light" />
      <ImageBackground
        source={require("@/assets/images/vedicbg.png")}
        resizeMode="cover"
        className="flex-1"
      >
        <View style={styles.backdrop} />
        <View style={styles.warmGlow} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: Platform.OS === "web" ? 34 : 18,
            paddingBottom: 70,
          }}
        >
          <View style={{ ...styles.content, maxWidth: 980 }}>
            <View
              style={{
                ...styles.header,
                marginBottom: isTabletOrWeb ? 34 : 28,
              }}
            >
              <Pressable
                onPress={() => router.back()}
                className="items-center justify-center"
                style={styles.backButton}
              >
                <ArrowLeft size={26} color="#F9D15A" strokeWidth={2.4} />
              </Pressable>

              <VStack
                className="items-center"
                style={{ paddingTop: isTabletOrWeb ? 30 : 66 }}
              >
                <Text
                  className="font-bold text-center"
                  style={{
                    ...styles.title,
                    fontSize: titleSize,
                    lineHeight: titleSize + 6,
                  }}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  Vedic Astrology
                </Text>

                <Text
                  className="mt-3 text-center"
                  style={styles.subtitle}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  Ancient Birth Chart & Planetary Guidance
                </Text>
              </VStack>
            </View>

            {featureRows.map((row, rowIndex) => (
              <HStack
                key={rowIndex}
                className="justify-center"
                style={{
                  marginBottom: rowIndex === featureRows.length - 1 ? 0 : 20,
                }}
              >
                {row.map((feature, index) => (
                  <View
                    key={feature.title}
                    style={{ marginRight: index === 0 ? rowGap : 0 }}
                  >
                    <CustomFeatureCard
                      title={feature.title}
                      description={feature.description}
                      icon={feature.icon}
                      width={cardWidth}
                      height={cardHeight}
                      cardBg={feature.cardBg}
                      iconBg={feature.iconBg}
                      onPress={() => router.push(feature.route as never)}
                    />
                  </View>
                ))}
              </HStack>
            ))}
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 2, 8, 0.58)",
  },
  warmGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(90, 7, 14, 0.22)",
  },
  content: {
    alignSelf: "center",
    width: "100%",
  },
  header: {
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "rgba(20, 9, 35, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(249, 209, 90, 0.28)",
    zIndex: 2,
  },
  title: {
    color: "#FFD45C",
    letterSpacing: 0,
    textShadowColor: "rgba(255, 119, 46, 0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18,
  },
  subtitle: {
    color: "#F0DEB1",
    fontSize: 18,
    lineHeight: 25,
  },
});

export default VedicAstrologyScreen;
