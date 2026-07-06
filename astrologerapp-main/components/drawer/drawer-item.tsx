import { LucideIcon } from "lucide-react-native";
import { MotiView } from "moti";
import { memo, useCallback, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type DrawerItemProps = {
  active?: boolean;
  badgeCount?: number;
  hasNotification?: boolean;
  icon: LucideIcon;
  onPress?: () => void;
  route?: string;
  style?: StyleProp<ViewStyle>;
  title: string;
};

function DrawerItemComponent({
  active = false,
  badgeCount,
  hasNotification = false,
  icon: Icon,
  onPress,
  style,
  title,
}: DrawerItemProps) {
  const [pressed, setPressed] = useState(false);
  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  return (
    <MotiView
      animate={{ scale: pressed ? 0.985 : 1 }}
      transition={{ type: "timing", duration: 110 }}
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <HStack style={[styles.item, active && styles.itemActive]}>
          <Icon color="#F0B35D" size={27} strokeWidth={2.15} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.title, active && styles.titleActive]}
          >
            {title}
          </Text>
          {typeof badgeCount === "number" ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount}</Text>
            </View>
          ) : null}
          {hasNotification ? <View style={styles.dot} /> : null}
        </HStack>
      </Pressable>
    </MotiView>
  );
}

export const DrawerItem = memo(DrawerItemComponent);

const styles = StyleSheet.create({
  item: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 16,
  },
  itemActive: {
    backgroundColor: "rgba(37, 66, 132, 0.66)",
    shadowColor: "rgba(212,167,87,0.22)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 7,
  },
  title: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 22,
    lineHeight: 29,
  },
  titleActive: {
    color: "#F0B35D",
    fontFamily: "Inter_600SemiBold",
  },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    backgroundColor: "#D4A757",
  },
  badgeText: {
    color: "#020817",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#D4A757",
  },
});
