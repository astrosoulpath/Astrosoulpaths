import { PropsWithChildren, memo } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";

import { VStack } from "@/components/ui/vstack";

type DrawerSectionProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

function DrawerSectionComponent({ children, style }: DrawerSectionProps) {
  return <VStack style={[styles.section, style]}>{children}</VStack>;
}

export const DrawerSection = memo(DrawerSectionComponent);

const styles = StyleSheet.create({
  section: {
    gap: 18,
  },
});
