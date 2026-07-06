import { useRouter } from "expo-router";
import { useEffect } from "react";

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen";
import { useAuth } from "@/src/features/auth/auth-provider";

export default function LogoutScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    const run = async () => {
      await logout();
      router.replace("/(auth)/login");
    };

    void run();
  }, [logout, router]);

  return <AuthLoadingScreen message="Logging you out..." />;
}
