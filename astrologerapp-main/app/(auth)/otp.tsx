import { Redirect } from "expo-router";

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen";
import { OtpScreen } from "@/components/auth/otp-screen";
import { useAuth } from "@/src/features/auth/auth-provider";

export default function OtpRoute() {
  const { isAuthenticated, pendingPhone, status } = useAuth();

  if (status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(drawer)" />;
  }

  if (!pendingPhone) {
    return <Redirect href="/(auth)/login" />;
  }

  return <OtpScreen />;
}
