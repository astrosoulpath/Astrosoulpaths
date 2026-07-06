import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfairFonts,
} from "@expo-google-fonts/playfair-display";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "@/components/common/app-error-boundary";
import "@/global.css";
import { astroColors } from "@/src/constants/colors";
import { AuthProvider } from "@/src/features/auth/auth-provider";
import { AudioCallBootstrap } from "@/src/features/calls/components/audio-call-bootstrap";
import { AppQueryProvider } from "@/src/providers/query-provider";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [playfairLoaded, playfairError] = usePlayfairFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  const isReady =
    (interLoaded && playfairLoaded) || !!interError || !!playfairError;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <GluestackUIProvider mode="dark">
          <AppQueryProvider>
            <AuthProvider>
              <AudioCallBootstrap />
              <SafeAreaProvider>
                <StatusBar style="light" translucent />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: astroColors.background },
                  }}
                />
              </SafeAreaProvider>
            </AuthProvider>
          </AppQueryProvider>
        </GluestackUIProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
