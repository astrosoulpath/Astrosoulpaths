import { LucideIcon } from "lucide-react-native";
import { memo } from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected: active,
      }}
      onPress={onPress}
      style={style}
    >
      <HStack
        style={[
          styles.item,
          active && styles.itemActive,
        ]}
      >
        <Icon
          color="#F0B35D"
          size={27}
          strokeWidth={2.15}
        />

        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[
            styles.title,
            active && styles.titleActive,
          ]}
        >
          {title}
        </Text>

        {typeof badgeCount === "number" ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount}
            </Text>
          </View>
        ) : null}

        {hasNotification ? (
          <View style={styles.dot} />
        ) : null}
      </HStack>
    </Pressable>
  );
}

export const DrawerItem = memo(DrawerItemComponent);

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    borderRadius: 18,
    gap: 18,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  itemActive: {
    backgroundColor: "rgba(37, 66, 132, 0.66)",
    elevation: 7,
    shadowColor: "rgba(212,167,87,0.22)",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.45,
    shadowRadius: 22,
  },
  title: {
    color: "#FFFFFF",
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 22,
    lineHeight: 29,
  },
  titleActive: {
    color: "#F0B35D",
    fontFamily: "Inter_600SemiBold",
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#D4A757",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    minWidth: 26,
    paddingHorizontal: 7,
  },
  badgeText: {
    color: "#020817",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  dot: {
    backgroundColor: "#D4A757",
    borderRadius: 4.5,
    height: 9,
    width: 9,
  },
});