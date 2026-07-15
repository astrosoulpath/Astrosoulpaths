import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { TopActionBar } from "@/components/header/top-action-bar";
import { Box } from "@/components/ui/box";
import { AppContainer } from "@/src/components/common/app-container";
import { GoLiveCard } from "@/src/components/live/go-live-card";
import { astroColors } from "@/src/constants/colors";
import { astroImages } from "@/src/constants/images";
import { useDashboard } from "@/src/features/dashboard/use-dashboard";

export default function HomeScreen() {
  const navigation = useNavigation();

  const {
    data,
    error,
    isLoading,
    isUpdatingStatus,
    toggleOnlineStatus,
  } = useDashboard();

  if (isLoading) {
    return (
      <AppContainer>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={astroColors.gold} />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Box style={styles.screen}>
        <TopActionBar
          balance={data?.earnings ?? 0}
          isOnline={data?.isOnline ?? false}
          onMenuPress={() =>
            navigation.dispatch(DrawerActions.openDrawer())
          }
        />

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image
              resizeMode="cover"
              source={astroImages.brandMark}
              style={styles.brandMark}
            />

            <Text style={styles.brand}>
              {data?.name ?? "Astro Soul Path"}
            </Text>

            <Text style={styles.tagline}>
              Guiding you to your true path
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {data ? (
            <DashboardStats data={data} style={styles.dashboard} />
          ) : null}

          <GoLiveCard
            onPress={() => {
              void toggleOnlineStatus();
            }}
            style={styles.goLive}
            subtitle={
              isUpdatingStatus
                ? "Updating..."
                : data?.isOnline
                  ? "Ready to receive consultations"
                  : "Tap to start receiving consultations"
            }
            title={data?.isOnline ? "You are Online" : "Go Live"}
          />
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
  loader: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: astroColors.white,
    fontSize: 16,
    marginTop: 16,
  },
  hero: {
    alignItems: "center",
    paddingBottom: 20,
    paddingTop: 34,
  },
  brandMark: {
    borderRadius: 86,
    height: 172,
    marginBottom: 12,
    width: 172,
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
  error: {
    color: "#FF6B6B",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  dashboard: {
    marginBottom: 16,
    marginTop: 20,
  },
  goLive: {
    marginBottom: 0,
    marginTop: 16,
  },
});