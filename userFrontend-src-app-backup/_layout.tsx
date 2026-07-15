import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "../features/auth/AuthProvider";
import { CallProvider } from "../features/calls/CallProvider";
import { useAuth } from "../hooks/useAuth";

function AppContent() {
  const {
    user,
  } = useAuth();

  const userId =
    user?.id?.trim() || null;

  return (
    <CallProvider
      userId={userId}
    >
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </CallProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}