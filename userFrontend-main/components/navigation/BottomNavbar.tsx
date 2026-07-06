import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { appRoutes } from "@/src/navigation/routes";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { Grid2x2, House, Leaf, Sparkles, User } from "lucide-react-native";
import React from "react";
import { LayoutChangeEvent, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type BottomNavItem = {
  name: string;
  icon: typeof House;
  route: string;
};

type BottomNavbarProps = {
  className?: string;
  activeColor?: string;
  inactiveColor?: string;
  gradientColors?: readonly [string, string, ...string[]];
  borderColor?: string;
  backgroundRadius?: number;
  bottomSpacing?: number;
  sideSpacing?: number;
  labelClassName?: string;
  activeLabelClassName?: string;
  iconSize?: "xs" | "sm" | "md" | "lg" | "xl";
};

const defaultTabs: BottomNavItem[] = [
  { name: "Home", icon: House, route: appRoutes.home },
  { name: "Kundli", icon: Grid2x2, route: appRoutes.kundli },
  { name: "Insights", icon: Sparkles, route: appRoutes.insights },
  { name: "Remedies", icon: Leaf, route: appRoutes.remedies },
  { name: "Profile", icon: User, route: appRoutes.profile },
];

type BottomTabButtonProps = {
  tab: BottomNavItem;
  isActive: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  labelClassName: string;
  activeLabelClassName: string;
  iconSize: BottomNavbarProps["iconSize"];
};

function BottomTabButton({
  tab,
  isActive,
  onPress,
  activeColor,
  inactiveColor,
  labelClassName,
  activeLabelClassName,
  iconSize,
}: BottomTabButtonProps) {
  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 220 });
  }, [isActive, progress]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [0, -4]) },
        { scale: interpolate(progress.value, [0, 1], [1, 1.05]) },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
      transform: [{ scale: interpolate(progress.value, [0, 1], [0.82, 1]) }],
    };
  });

  const iconWrapStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ["rgba(255,255,255,0)", "rgba(244,197,66,0.18)"],
      ),
      borderColor: interpolateColor(
        progress.value,
        [0, 1],
        ["rgba(255,255,255,0)", "rgba(244,197,66,0.24)"],
      ),
    };
  });

  return (
    <Pressable className="flex-1 items-center justify-center" onPress={onPress}>
      <Animated.View style={containerStyle}>
        <VStack className="items-center justify-center px-2 py-1">
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 3,
                alignSelf: "center",
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: "rgba(244,197,66,0.12)",
                shadowColor: "#F4C542",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.22,
                shadowRadius: 16,
                elevation: 6,
              },
              glowStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: 34,
                height: 34,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                marginBottom: 4,
              },
              iconWrapStyle,
            ]}
          >
            <Icon
              as={tab.icon}
              size={iconSize}
              color={isActive ? activeColor : inactiveColor}
            />
          </Animated.View>
          <Text
            className={`${labelClassName} ${
              isActive ? activeLabelClassName : ""
            }`}
            style={{
              color: isActive ? activeColor : inactiveColor,
              fontSize: isActive ? 11.5 : 10.5,
              letterSpacing: isActive ? 0.2 : 0,
            }}
          >
            {tab.name}
          </Text>
        </VStack>
      </Animated.View>
    </Pressable>
  );
}

export default function BottomNavbar({
  className = "",
  activeColor = "#F4C542",
  inactiveColor = "rgba(214,217,245,0.60)",
  gradientColors = [
    "rgba(8,14,55,0.96)",
    "rgba(12,18,70,0.94)",
    "rgba(18,27,80,0.96)",
  ],
  borderColor = "rgba(255,215,106,0.12)",
  backgroundRadius = 34,
  bottomSpacing = 20,
  sideSpacing = 20,
  labelClassName = "text-xs mt-1",
  activeLabelClassName = "font-semibold",
  iconSize = "md",
}: BottomNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [barWidth, setBarWidth] = React.useState(0);
  const activeIndex = Math.max(
    defaultTabs.findIndex((tab) => tab.route === pathname),
    0,
  );
  const indicatorProgress = useSharedValue(activeIndex);

  React.useEffect(() => {
    indicatorProgress.value = withTiming(activeIndex, { duration: 260 });
  }, [activeIndex, indicatorProgress]);

  const handleBarLayout = React.useCallback((event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  }, []);

  const indicatorTravel = React.useMemo(() => {
    if (!barWidth) {
      return 0;
    }

    const innerWidth = Math.max(barWidth - 20, 0);
    const tabWidth = innerWidth / defaultTabs.length;

    return tabWidth;
  }, [barWidth]);

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: indicatorTravel ? 1 : 0,
      transform: [{ translateX: indicatorProgress.value * indicatorTravel }],
    };
  });

  return (
    <View
      className={`absolute ${className}`}
      style={{ bottom: bottomSpacing, left: sideSpacing, right: sideSpacing }}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: backgroundRadius,
          paddingVertical: 9,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor,
          shadowColor: "#FFD56A",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 16,
        }}
        onLayout={handleBarLayout}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 6,
              bottom: 6,
              left: 10,
              width: indicatorTravel,
              borderRadius: 26,
              overflow: "hidden",
            },
            indicatorStyle,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(244,197,66,0.20)",
              "rgba(244,197,66,0.08)",
              "rgba(255,255,255,0.03)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "rgba(244,197,66,0.12)",
            }}
          />
        </Animated.View>
        <HStack className="justify-between items-center">
          {defaultTabs.map((tab) => {
            const isActive = pathname === tab.route;

            return (
              <BottomTabButton
                key={tab.route}
                tab={tab}
                isActive={isActive}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                labelClassName={labelClassName}
                activeLabelClassName={activeLabelClassName}
                iconSize={iconSize}
                onPress={() => router.replace(tab.route as never)}
              />
            );
          })}
        </HStack>
      </LinearGradient>
    </View>
  );
}
