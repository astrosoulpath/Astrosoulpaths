import { Image } from "expo-image";
import { PropsWithChildren, memo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { astroImages } from "@/src/constants/images";

type CosmicBackgroundProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

function CosmicBackgroundComponent({ children, style }: CosmicBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <Image
        source={astroImages.background}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tint} />
      {children}
    </View>
  );
}

export const CosmicBackground = memo(CosmicBackgroundComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#020817",
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3, 13, 38, 0.78)",
  },
});
