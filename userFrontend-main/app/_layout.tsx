import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { queryClient } from "@/lib/query/query-client";
import { supabase } from "@/lib/supabase/client";
import { initializeNotifications } from "@/src/services/notifications/notifications.service";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ErrorBoundaryProps } from "expo-router";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import "../global.css";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "index",
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  React.useEffect(() => {
    console.error("[RootLayout] Unhandled route error", error);
  }, [error]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#080e37" }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          gap: 12,
        }}
      >
        <Text style={{ color: "#F4C56D", fontSize: 24, fontWeight: "700" }}>
          Something went wrong
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.82)", textAlign: "center" }}>
          The app hit an unexpected error while loading this screen.
        </Text>
        <Pressable
          onPress={retry}
          style={{
            marginTop: 8,
            borderRadius: 999,
            backgroundColor: "#F4C56D",
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#080e37", fontWeight: "700" }}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = React.useState(false);

  React.useEffect(() => {
    let isDisposed = false;
    let unsubscribeAuthListener: (() => void) | undefined;

    const initializeStores = async () => {
      await Promise.all([Promise.resolve(useAuthStore.persist.rehydrate())]);

      if (isDisposed) {
        return;
      }

      const syncSupabaseSession = useAuthStore.getState().syncSupabaseSession;
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (__DEV__) {
            console.log("[RootLayout] Supabase auth state changed", {
              event,
              hasAccessToken: Boolean(session?.access_token),
              tokenLength: session?.access_token?.length || 0,
            });
          }

          syncSupabaseSession(session);
        },
      );

      unsubscribeAuthListener = () => {
        authListener.subscription.unsubscribe();
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isDisposed) {
        syncSupabaseSession(session);
        setIsAppReady(true);
      }
    };

    void initializeStores().catch((error) => {
      console.error("[RootLayout] Initialization failed", error);

      if (!isDisposed) {
        setIsAppReady(true);
      }
    });

    return () => {
      isDisposed = true;
      unsubscribeAuthListener?.();
    };
  }, []);

  React.useEffect(() => {
    if (!isAppReady) {
      return;
    }

    void SplashScreen.hideAsync();
  }, [isAppReady]);

  React.useEffect(() => {
    void initializeNotifications().catch((error) => {
      console.warn("[RootLayout] Notification setup failed", error);
    });
  }, []);

  if (!isAppReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GluestackUIProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </GluestackUIProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
