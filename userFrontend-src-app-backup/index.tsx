import { Redirect } from "expo-router";

import { useAuth } from "../hooks/useAuth";
import { SplashScreen } from "../screens/SplashScreen";

export default function IndexPage() {
  const {
    loading,
    authenticated,
  } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (authenticated) {
    return (
      <Redirect href="/home" />
    );
  }

  return (
    <Redirect href="/(auth)/otp-login" />
  );
}