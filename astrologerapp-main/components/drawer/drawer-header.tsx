import { Star } from "lucide-react-native";
import { ImageSourcePropType, StyleSheet, View } from "react-native";
import { memo } from "react";

import { AppAvatar } from "@/components/common/app-avatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type AppDrawerHeaderProps = {
  avatarSource?: ImageSourcePropType;
  name?: string;
  rating?: number;
  reviews?: number;
};

function AppDrawerHeaderComponent({
  avatarSource,
  name = "Saksham",
  rating = 4.8,
  reviews = 128,
}: AppDrawerHeaderProps) {
  return (
    <HStack style={styles.root}>
      <AppAvatar source={avatarSource} />
      <VStack style={styles.copy}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.greeting}>
          Hi {name},
        </Text>
        <HStack style={styles.ratingPill}>
          <Star color="#F0B35D" fill="#F0B35D" size={20} strokeWidth={2} />
          <Text style={styles.rating}>{rating.toFixed(1)}</Text>
          <View style={styles.ratingDivider} />
          <Text numberOfLines={1} style={styles.reviews}>
            {reviews} Reviews
          </Text>
        </HStack>
      </VStack>
    </HStack>
  );
}

export const AppDrawerHeader = memo(AppDrawerHeaderComponent);

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  greeting: {
    color: "#FFFFFF",
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 31,
    lineHeight: 38,
  },
  ratingPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 9,
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(122, 145, 209, 0.58)",
    backgroundColor: "rgba(18, 34, 80, 0.46)",
  },
  rating: {
    color: "#F0B35D",
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    lineHeight: 25,
  },
  ratingDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(182,184,214,0.28)",
  },
  reviews: {
    flexShrink: 1,
    color: "#D8DAF0",
    fontFamily: "Inter_400Regular",
    fontSize: 17,
    lineHeight: 23,
  },
});
