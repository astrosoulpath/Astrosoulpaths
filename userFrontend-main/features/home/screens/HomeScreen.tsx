import CustomFeatureCard from "@/components/custom/Cust_Card";
import NotificationBell from "@/components/home/NotificationBell";
import WalletCard from "@/components/home/WalletCard";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { appRoutes } from "@/src/navigation/routes";
import { useRouter } from "expo-router";
import {
  Hash,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Wand2,
} from "lucide-react-native";
import React from "react";
import {
  ImageBackground,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const featureRows = [
  [
    {
      title: "Vedic\nAstrology",
      description: "Your personalized\nbirth chart and\nplanetary insights.",
      icon: Sun,
    },
    {
      title: "Western\nAstrology",
      description: "Daily horoscopes\nbased on your\nzodiac sign.",
      icon: Sparkles,
    },
  ],
  [
    {
      title: "Tarot\nReading",
      description: "Daily card draw for\nclarity, guidance and\ninner peace.",
      icon: Star,
    },
    {
      title: "Numerology",
      description: "Discover your life\npath number and\nhidden meaning.",
      icon: Hash,
    },
  ],
  [
    {
      title: "Ask Astrologer",
      description: "Get answers to your\nquestions from\nexpert astrologers.",
      icon: UserRound,
    },
    {
      title: "Daily Insights",
      description: "Short daily guidance\nto help you make\nbetter decisions.",
      icon: Wand2,
    },
  ],
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 380 ? 16 : 20;
  const rowGap = width < 380 ? 12 : 16;
  const contentWidth = Math.min(width - horizontalPadding * 2, 360);
  const cardWidth = Math.min(165, (contentWidth - rowGap) / 2);

  return (
    <SafeAreaView className="flex-1">
      <ImageBackground
        source={require("@/assets/images/background.png")}
        resizeMode="cover"
        className="flex-1"
      >
        <View className="absolute inset-0 bg-black/20" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 30,
            paddingBottom: 120,
          }}
        >
          <VStack className="mb-10 relative">
            <HStack space="sm" className="absolute top-0 right-0 items-center">
              <WalletCard
                balance={1250}
                width={100}
                height={54}
                fontSize={14}
                iconSize={30}
              />
              <NotificationBell
                width={54}
                height={54}
                onPress={() => router.push(appRoutes.comingSoon as never)}
              />
            </HStack>

            <VStack style={{ marginTop: 88, marginStart: 4 }}>
              <Text
                className="text-4xl font-bold"
                style={{ color: "#F4C542", lineHeight: 42 }}
              >
                Welcome
              </Text>
              <Text
                className="text-2xl leading-9"
                style={{ color: "#B8C2E6", marginTop: 6 }}
              >
                Cosmic guidance{"\n"}awaits
              </Text>
            </VStack>
          </VStack>

          {featureRows.map((row, rowIndex) => (
            <HStack
              key={rowIndex}
              className="justify-center"
              style={{
                marginBottom: rowIndex === featureRows.length - 1 ? 32 : 20,
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
                    onPress={() => router.push(appRoutes.comingSoon as never)}
                    width={cardWidth}
                    height={250}
                  />
                </View>
              ))}
            </HStack>
          ))}

          <View
            className="rounded-[28px] p-5"
            style={{
              backgroundColor: "rgba(10,20,90,0.30)",
              borderWidth: 1,
              borderColor: "rgba(255,215,106,0.12)",
            }}
          >
            <HStack space="lg" className="items-center">
              <Text className="text-5xl text-[#F4C542]">✦</Text>
              <VStack className="flex-1">
                <Text
                  className="text-xl font-bold mb-2"
                  style={{ color: "#F4C542" }}
                >
                  Today’s Cosmic Message
                </Text>
                <Text
                  className="text-base leading-6"
                  style={{ color: "#D6D9F5" }}
                >
                  Trust the timing of your life.{"\n"}
                  The universe is always aligned with you.
                </Text>
              </VStack>
            </HStack>
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}
