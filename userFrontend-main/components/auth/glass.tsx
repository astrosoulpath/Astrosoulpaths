import { Text } from "@/components/ui/text";
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";

const glassCardStyle = tva({
  base: "relative w-full overflow-hidden",
  variants: {
    size: {
      sm: "",
      md: "",
      lg: "",
    },
    radius: {
      md: "rounded-2xl",
      lg: "rounded-[28px]",
      xl: "rounded-[34px]",
    },
  },
  defaultVariants: {
    size: "md",
    radius: "lg",
  },
});

type GlassElevation = "none" | "soft" | "medium" | "high";

type GlassAuthCardProps = ViewProps &
  VariantProps<typeof glassCardStyle> & {
    className?: string;
    contentClassName?: string;
    title?: string;
    subtitle?: string;
    titleClassName?: string;
    subtitleClassName?: string;
    titleStyle?: StyleProp<TextStyle>;
    subtitleStyle?: StyleProp<TextStyle>;
    borderWidth?: number;
    borderRadius?: number;
    backgroundColor?: string;
    innerStrokeColor?: string;
    borderGradientColors?: readonly [string, string, ...string[]];
    surfaceGradientColors?: readonly [string, string, ...string[]];
    overlayGradientColors?: readonly [string, string, ...string[]];
    showTopHighlight?: boolean;
    showBottomGlow?: boolean;
    floatingBadgeVisible?: boolean;
    floatingBadge?: React.ReactNode;
    floatingBadgeSize?: number;
    floatingBadgeOffsetY?: number;
    floatingBadgeOuterColors?: readonly [string, string, ...string[]];
    floatingBadgeInnerColor?: string;
    floatingBadgeBorderColor?: string;
    floatingBadgeGlowColor?: string;
    paddingHorizontal?: number;
    paddingVertical?: number;
    elevation?: GlassElevation;
    shadowColor?: string;
    webBoxShadow?: string;
  };

const radiusMap = {
  md: 22,
  lg: 28,
  xl: 34,
} as const;

const spacingMap = {
  sm: { px: 16, py: 18 },
  md: { px: 20, py: 22 },
  lg: { px: 24, py: 26 },
} as const;

function getElevationStyle(
  elevation: GlassElevation,
  shadowColor: string,
  webBoxShadow?: string,
): ViewStyle {
  if (elevation === "none") {
    return {};
  }

  const tokens = {
    soft: {
      opacity: 0.2,
      radius: 16,
      y: 8,
      native: 6,
      web: "0 10px 28px rgba(0,0,0,0.24)",
    },
    medium: {
      opacity: 0.28,
      radius: 22,
      y: 12,
      native: 11,
      web: "0 18px 40px rgba(0,0,0,0.34)",
    },
    high: {
      opacity: 0.34,
      radius: 28,
      y: 16,
      native: 16,
      web: "0 26px 56px rgba(0,0,0,0.42)",
    },
  }[elevation];

  if (Platform.OS === "web") {
    return {
      shadowColor,
      shadowOpacity: tokens.opacity,
      shadowRadius: tokens.radius,
      shadowOffset: { width: 0, height: tokens.y },
      ...(webBoxShadow
        ? { boxShadow: webBoxShadow }
        : { boxShadow: tokens.web }),
    } as ViewStyle;
  }

  return {
    shadowColor,
    shadowOpacity: tokens.opacity,
    shadowRadius: tokens.radius,
    shadowOffset: { width: 0, height: tokens.y },
    elevation: tokens.native,
  };
}

export function GlassAuthCard({
  children,
  className,
  contentClassName,
  title,
  subtitle,
  titleClassName,
  subtitleClassName,
  titleStyle,
  subtitleStyle,
  size = "md",
  radius = "lg",
  borderWidth = 1.2,
  borderRadius,
  backgroundColor = "rgba(17, 24, 62, 0.68)",
  innerStrokeColor = "rgba(255, 219, 154, 0.16)",
  borderGradientColors = [
    "rgba(255, 196, 95, 0.72)",
    "rgba(141, 117, 255, 0.28)",
    "rgba(255, 196, 95, 0.38)",
  ],
  surfaceGradientColors = [
    "rgba(62, 72, 140, 0.35)",
    "rgba(24, 24, 68, 0.22)",
    "rgba(12, 14, 39, 0.72)",
  ],
  overlayGradientColors = [
    "rgba(255, 255, 255, 0.12)",
    "rgba(255, 255, 255, 0.02)",
    "rgba(110, 93, 198, 0.1)",
  ],
  showTopHighlight = true,
  showBottomGlow = true,
  floatingBadgeVisible = true,
  floatingBadge,
  floatingBadgeSize = 56,
  floatingBadgeOffsetY = -28,
  floatingBadgeOuterColors = [
    "rgba(255, 206, 112, 0.75)",
    "rgba(121, 93, 200, 0.5)",
    "rgba(255, 206, 112, 0.25)",
  ],
  floatingBadgeInnerColor = "rgba(34, 30, 78, 0.98)",
  floatingBadgeBorderColor = "rgba(255, 228, 168, 0.28)",
  floatingBadgeGlowColor = "rgba(255, 189, 84, 0.4)",
  paddingHorizontal,
  paddingVertical,
  elevation = "medium",
  shadowColor = "#000000",
  webBoxShadow,
  style,
  ...rest
}: GlassAuthCardProps) {
  const resolvedRadius = borderRadius ?? radiusMap[radius ?? "lg"];
  const spacing = spacingMap[size ?? "md"];
  const px = paddingHorizontal ?? spacing.px;
  const py = paddingVertical ?? spacing.py;
  const effectivePaddingTop =
    py + (floatingBadgeVisible ? floatingBadgeSize * 0.42 : 0);
  const panelShadow = getElevationStyle(elevation, shadowColor, webBoxShadow);

  return (
    <View
      style={[
        styles.host,
        {
          paddingTop: floatingBadgeVisible
            ? Math.max(0, floatingBadgeSize / 2 + floatingBadgeOffsetY + 10)
            : 0,
        },
      ]}
      {...rest}
    >
      {floatingBadgeVisible ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.badgeAnchor,
            {
              top: floatingBadgeOffsetY,
              width: floatingBadgeSize,
              height: floatingBadgeSize,
              borderRadius: floatingBadgeSize / 2,
              transform: [{ translateX: -floatingBadgeSize / 2 }],
            },
          ]}
        >
          <LinearGradient
            colors={floatingBadgeOuterColors}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.badgeOuter,
              {
                width: floatingBadgeSize,
                height: floatingBadgeSize,
                borderRadius: floatingBadgeSize / 2,
                shadowColor: floatingBadgeGlowColor,
                shadowOpacity: 0.58,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 5 },
                elevation: 12,
              },
            ]}
          >
            <View
              style={[
                styles.badgeInner,
                {
                  backgroundColor: floatingBadgeInnerColor,
                  borderColor: floatingBadgeBorderColor,
                  width: floatingBadgeSize - 4,
                  height: floatingBadgeSize - 4,
                  borderRadius: (floatingBadgeSize - 4) / 2,
                },
              ]}
            >
              {floatingBadge}
            </View>
          </LinearGradient>
        </View>
      ) : null}

      <LinearGradient
        colors={borderGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: resolvedRadius + borderWidth,
          padding: borderWidth,
        }}
      >
        <View
          className={glassCardStyle({ size, radius, class: className })}
          style={[
            styles.surface,
            panelShadow,
            {
              borderRadius: resolvedRadius,
              backgroundColor,
            },
            style,
          ]}
        >
          <LinearGradient
            colors={surfaceGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: resolvedRadius },
            ]}
          />

          <LinearGradient
            colors={overlayGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: resolvedRadius },
            ]}
          />

          <View
            style={[
              styles.innerStroke,
              {
                borderRadius: Math.max(0, resolvedRadius - 1),
                borderColor: innerStrokeColor,
              },
            ]}
          />

          {showTopHighlight ? (
            <LinearGradient
              colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.topHighlight,
                {
                  borderTopLeftRadius: resolvedRadius,
                  borderTopRightRadius: resolvedRadius,
                },
              ]}
            />
          ) : null}

          {showBottomGlow ? (
            <LinearGradient
              colors={["rgba(255, 200, 104, 0)", "rgba(255, 200, 104, 0.2)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.bottomGlow}
            />
          ) : null}

          <View
            className={contentClassName}
            style={{
              paddingHorizontal: px,
              paddingBottom: py,
              paddingTop: effectivePaddingTop,
            }}
          >
            {title ? (
              <Text
                className={titleClassName}
                style={[
                  {
                    color: "#F8F4FF",
                    textAlign: "center",
                    fontSize: 31,
                    lineHeight: 37,
                    fontWeight: "700",
                    letterSpacing: 0.2,
                  },
                  titleStyle,
                ]}
              >
                {title}
              </Text>
            ) : null}

            {subtitle ? (
              <Text
                className={subtitleClassName}
                style={[
                  {
                    color: "rgba(223, 223, 242, 0.86)",
                    textAlign: "center",
                    fontSize: 16,
                    lineHeight: 24,
                    marginTop: 8,
                    marginBottom: 18,
                  },
                  subtitleStyle,
                ]}
              >
                {subtitle}
              </Text>
            ) : null}

            {children}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
    position: "relative",
  },
  surface: {
    overflow: "hidden",
    position: "relative",
  },
  innerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  badgeAnchor: {
    position: "absolute",
    left: "50%",
    zIndex: 20,
  },
  badgeOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInner: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  bottomGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 42,
  },
});

export default GlassAuthCard;
