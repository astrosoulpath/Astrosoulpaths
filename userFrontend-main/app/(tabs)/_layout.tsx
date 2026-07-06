import BottomNavbar from "@/components/navigation/BottomNavbar";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { appRoutes, resolveAuthenticatedRoute } from "@/src/navigation/routes";
import { Redirect, Slot } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function TabsLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);
  const nextStep = useAuthStore((state) => state.nextStep);
  const user = useAuthStore((state) => state.user);
  const resolvedRoute = resolveAuthenticatedRoute(
    nextStep,
    user?.isProfileComplete,
  );

  if (!hydrated) {
    return null;
  }

  if (status !== "authenticated") {
    return <Redirect href={appRoutes.otpLogin} />;
  }

  if (!resolvedRoute) {
    return <Redirect href={appRoutes.root} />;
  }

  if (resolvedRoute !== appRoutes.home) {
    return <Redirect href={resolvedRoute} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      <BottomNavbar iconSize="xl" />
    </View>
  );
}
