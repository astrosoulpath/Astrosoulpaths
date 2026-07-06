import { PropsWithChildren } from "react";
import { ImageBackground, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Box } from "@/components/ui/box";
import { astroColors } from "@/src/constants/colors";
import { astroImages } from "@/src/constants/images";

export function AppContainer({ children }: PropsWithChildren) {
  return (
    <Box style={styles.root}>
      <ImageBackground
        source={astroImages.background}
        resizeMode="cover"
        style={styles.background}
      >
        <Box style={styles.vignette} />
        <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
      </ImageBackground>
    </Box>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: astroColors.background,
  },
  background: {
    flex: 1,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 8, 23, 0.16)",
  },
  safeArea: {
    flex: 1,
  },
});
