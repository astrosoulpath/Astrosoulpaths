import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { TopActionBar } from "@/components/header/top-action-bar";
import { Box } from "@/components/ui/box";
import { AppContainer } from "@/src/components/common/app-container";
import { GoLiveCard } from "@/src/components/live/go-live-card";
import { astroColors } from "@/src/constants/colors";
import { astroImages } from "@/src/constants/images";

export default function HomeScreen() {
  const navigation = useNavigation();

  return (
    <AppContainer>
      <Box style={styles.screen}>
        <TopActionBar
          balance={32}
          isOnline={false}
          onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        />

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image
              source={astroImages.brandMark}
              resizeMode="cover"
              style={styles.brandMark}
            />
            <Text style={styles.brand}>Astro Soul Path</Text>
            <Text style={styles.tagline}>Guiding you to your true path</Text>
          </View>

          <GoLiveCard style={styles.goLive} />
        </ScrollView>
      </Box>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 22,
  },
  content: {
    paddingBottom: 28,
  },
  hero: {
    alignItems: "center",
    paddingTop: 34,
    paddingBottom: 20,
  },
  brandMark: {
    width: 172,
    height: 172,
    borderRadius: 86,
    marginBottom: 12,
  },
  brand: {
    color: astroColors.white,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 39,
    lineHeight: 47,
    textAlign: "center",
  },
  tagline: {
    color: "#F6BE61",
    fontFamily: "Inter_400Regular",
    fontSize: 19,
    lineHeight: 26,
    textAlign: "center",
  },
  mapCard: {
    marginTop: 6,
  },
  goLive: {
    marginTop: 16,
    marginBottom: 0,
  },
});
