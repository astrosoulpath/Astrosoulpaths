import { useAuthStore } from "@/features/auth/store/auth.store";
import { appRoutes, resolveAuthenticatedRoute } from "@/src/navigation/routes";
import { Redirect, Stack, useSegments } from "expo-router";
import React from "react";
import { ImageBackground } from "react-native";

export default function AuthLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);
  const nextStep = useAuthStore((state) => state.nextStep);
  const user = useAuthStore((state) => state.user);
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1];
  const resolvedRoute = resolveAuthenticatedRoute(
    nextStep,
    user?.isProfileComplete,
  );

  if (!hydrated) {
    return null;
  }

  if (status === "authenticated") {
    if (!resolvedRoute) {
      return <Redirect href={appRoutes.root} />;
    }

    if (resolvedRoute === appRoutes.onboarding) {
      if (currentRoute !== "onboarding") {
        return <Redirect href={appRoutes.onboarding} />;
      }

      return (
        <ImageBackground
          source={require("@/assets/images/authbg.png")}
          className="flex-1"
          resizeMode="cover"
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
        </ImageBackground>
      );
    }

    return <Redirect href={appRoutes.home} />;
  }

  return (
    <ImageBackground
      source={require("@/assets/images/authbg.png")}
      className="flex-1"
      resizeMode="cover"
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </ImageBackground>
  );
}
