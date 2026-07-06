import { Redirect } from "expo-router";

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen";
import { LoginScreen } from "@/components/auth/login-screen";
import { useAuth } from "@/src/features/auth/auth-provider";

export default function LoginRoute() {
  const { isAuthenticated, status } = useAuth();

  if (status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(drawer)" />;
  }

  return <LoginScreen />;
}
