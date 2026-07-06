import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { CustomFeatureCardProps } from "./interface/Cust_Card";

export default function CustomFeatureCard({
  title,
  description,
  icon,
  onPress,

  width = 160,
  height,

  className = "",
  cardClassName = "",
  iconClassName = "",
  arrowClassName = "",
  titleClassName = "",
  descriptionClassName = "",

  cardBg = "rgba(30, 29, 82, 0.58)",

  iconBg = "rgba(22, 29, 82, 0.7)",
  iconColor = "#FFD45C",

  arrowBg = "rgba(18, 20, 56, 0.64)",
  arrowColor = "#F7E5B2",

  titleColor = "#FFFFFF",
  descriptionColor = "#EEE1C6",
}: CustomFeatureCardProps) {
  const numericWidth = typeof width === "number" ? width : 160;
  const isPhoneCard = numericWidth <= 170;
  const isCompact = numericWidth < 150;
  const radius = isCompact ? 22 : 26;
  const cardPadding = isCompact ? 13 : isPhoneCard ? 15 : 18;
  const iconOuterSize = isCompact ? 50 : isPhoneCard ? 54 : 64;
  const iconInnerSize = isCompact ? 42 : isPhoneCard ? 46 : 54;
  const arrowOuterSize = isCompact ? 36 : isPhoneCard ? 38 : 44;
  const arrowInnerSize = isCompact ? 30 : isPhoneCard ? 32 : 38;
  const titleSize = isCompact ? 17.5 : isPhoneCard ? 19 : 22;
  const descriptionSize = isCompact ? 12 : isPhoneCard ? 13 : 14.5;
  const titleLineHeight = titleSize + 4;
  const descriptionLineHeight = descriptionSize + 5;
  const titleBlockHeight = titleLineHeight * 2;
  const descriptionBlockHeight = descriptionLineHeight * 3;

  return (
    <Pressable
      onPress={onPress}
      className={className}
      style={{ alignSelf: "flex-start" }}
    >
      <LinearGradient
        colors={[
          "rgba(255, 214, 111, 0.42)",
          "rgba(204, 90, 89, 0.18)",
          "rgba(120, 99, 204, 0.24)",
        ]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius, padding: 1 }}
      >
        <Card
          className={`overflow-hidden ${cardClassName}`}
          style={{
            width,
            height,
            minHeight: height ? undefined : 220,
            backgroundColor: cardBg,
            borderRadius: radius,
            padding: cardPadding,
          }}
        >
          <LinearGradient
            colors={[
              "rgba(255, 219, 140, 0.12)",
              "rgba(255, 255, 255, 0.03)",
              "rgba(26, 15, 60, 0.18)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              borderRadius: radius,
            }}
          />
          <VStack style={{ ...styles.innerStroke, borderRadius: radius }} />
          <VStack style={styles.orbitOne} />
          <VStack style={styles.orbitTwo} />

          <VStack className="flex-1 justify-between">
            <VStack>
              <LinearGradient
                colors={[
                  "rgba(255, 215, 106, 0.32)",
                  "rgba(173, 75, 113, 0.12)",
                  "rgba(89, 92, 178, 0.18)",
                ]}
                style={{
                  width: iconOuterSize,
                  height: iconOuterSize,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <VStack
                  className={`rounded-full items-center justify-center ${iconClassName}`}
                  style={{
                    width: iconInnerSize,
                    height: iconInnerSize,
                    backgroundColor: iconBg,
                    borderWidth: 1,
                    borderColor: "rgba(255, 220, 130, 0.12)",
                  }}
                >
                  <Icon
                    as={icon}
                    size={isPhoneCard ? "lg" : "xl"}
                    color={iconColor}
                  />
                </VStack>
              </LinearGradient>

              <VStack style={{ marginTop: isPhoneCard ? 12 : 16 }}>
                <Text
                  className={`font-bold ${titleClassName}`}
                  style={{
                    color: titleColor,
                    fontSize: titleSize,
                    lineHeight: titleLineHeight,
                    minHeight: titleBlockHeight,
                    fontFamily: premiumFont,
                  }}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {title}
                </Text>

                <Text
                  className={descriptionClassName}
                  style={{
                    color: descriptionColor,
                    fontSize: descriptionSize,
                    lineHeight: descriptionLineHeight,
                    minHeight: descriptionBlockHeight,
                    marginTop: 2,
                    fontFamily: premiumFont,
                  }}
                  numberOfLines={3}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {description}
                </Text>
              </VStack>
            </VStack>

            <HStack className="justify-end" style={{ marginTop: 6 }}>
              <LinearGradient
                colors={["rgba(255, 215, 106, 0.20)", "rgba(123, 92, 179, 0.16)"]}
                style={{
                  width: arrowOuterSize,
                  height: arrowOuterSize,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <VStack
                  className={`rounded-full items-center justify-center ${arrowClassName}`}
                  style={{
                    width: arrowInnerSize,
                    height: arrowInnerSize,
                    backgroundColor: arrowBg,
                    borderWidth: 1,
                    borderColor: "rgba(255, 220, 130, 0.10)",
                  }}
                >
                  <Icon as={ArrowRight} size="md" color={arrowColor} />
                </VStack>
              </LinearGradient>
            </HStack>
          </VStack>

          <VStack style={{ ...styles.star, ...styles.starLarge }} />
          <VStack style={{ ...styles.star, ...styles.starMedium }} />
          <VStack style={{ ...styles.star, ...styles.starSmall }} />
        </Card>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  innerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255, 235, 178, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.018)",
  },
  orbitOne: {
    position: "absolute",
    right: -38,
    top: 38,
    width: 118,
    height: 118,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 106, 0.08)",
  },
  orbitTwo: {
    position: "absolute",
    right: -12,
    bottom: -42,
    width: 116,
    height: 116,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(193, 160, 255, 0.07)",
  },
  star: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255, 213, 106, 0.38)",
  },
  starLarge: {
    top: 28,
    right: 34,
    width: 5,
    height: 5,
  },
  starMedium: {
    top: 54,
    right: 56,
    width: 4,
    height: 4,
    backgroundColor: "rgba(207, 178, 255, 0.3)",
  },
  starSmall: {
    right: 42,
    bottom: 72,
    width: 3,
    height: 3,
    backgroundColor: "rgba(255, 213, 106, 0.2)",
  },
});

const premiumFont = Platform.select({
  ios: "System",
  android: "sans-serif-medium",
  web: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  default: undefined,
});
