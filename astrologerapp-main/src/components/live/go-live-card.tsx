import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Video } from "lucide-react-native";
import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { GlassCard } from "@/src/components/common/glass-card";

type GoLiveCardProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

export function GoLiveCard({
  title = "Go Live",
  subtitle = "Start your live session",
  icon,
  onPress,
  style,
}: GoLiveCardProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.975,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 6,
      tension: 110,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (event: GestureResponderEvent) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.(event);
  };

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.15],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.48, 0.2, 0],
  });

  return (
    <Animated.View style={[{ transform: [{ scale: pressScale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <GlassCard style={styles.card}>
          <View style={styles.content}>
            <View style={styles.orbitWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
              <View style={[styles.orbit, styles.orbitOne]} />
              <View style={[styles.orbit, styles.orbitTwo]} />
              <View style={[styles.orbit, styles.orbitThree]} />
              <LinearGradient
                colors={["#FFE6A9", "#E1AB55", "#BC7E32"]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.liveButton}
              >
                <View style={styles.innerGlow} />
                {icon ?? (
                  <View style={styles.liveIconWrap}>
                    <View style={styles.liveDot} />
                    <Video
                      color="#061028"
                      fill="rgba(6, 16, 40, 0.16)"
                      size={68}
                      strokeWidth={3.8}
                    />
                  </View>
                )}
                {icon ? (
                  <View style={styles.liveDot} />
                ) : null}
              </LinearGradient>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 310,
    borderRadius: 28,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  orbitWrap: {
    width: 178,
    height: 178,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  pulseRing: {
    position: "absolute",
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 2,
    borderColor: "rgba(245, 198, 116, 0.55)",
  },
  orbit: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212, 167, 87, 0.32)",
  },
  orbitOne: {
    width: 170,
    height: 170,
  },
  orbitTwo: {
    width: 148,
    height: 148,
  },
  orbitThree: {
    width: 124,
    height: 124,
    borderColor: "rgba(212, 167, 87, 0.2)",
  },
  liveButton: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F3C873",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 20,
    elevation: 12,
  },
  liveIconWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: {
    position: "absolute",
    top: 7,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E93D4F",
    borderWidth: 2,
    borderColor: "#FFF1C7",
    zIndex: 2,
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 58,
    borderWidth: 2,
    borderColor: "rgba(255, 243, 207, 0.46)",
  },
  title: {
    color: "#FFE2AE",
    fontFamily: "Inter_500Medium",
    fontSize: 42,
    lineHeight: 50,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    color: "#C9CBE6",
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
});
