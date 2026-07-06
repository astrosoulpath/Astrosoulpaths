import { Drawer } from "expo-router/drawer";

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen";
import { CustomDrawerContent } from "@/components/drawer/custom-drawer-content";
import { astroColors } from "@/src/constants/colors";
import { useAuth } from "@/src/features/auth/auth-provider";

export default function DrawerLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return <AuthLoadingScreen message="Loading dashboard..." />;
  }

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: "rgba(2,8,23,0.96)",
          width: "88%",
          maxWidth: 360,
        },
        drawerType: "front",
        headerShown: false,
        overlayColor: "rgba(0, 4, 16, 0.72)",
        sceneStyle: { backgroundColor: astroColors.background },
        swipeEdgeWidth: 64,
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home" }} />
      <Drawer.Screen name="audio-call" options={{ title: "Audio Call" }} />
      <Drawer.Screen name="profile" options={{ title: "Profile" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
      <Drawer.Screen name="support" options={{ title: "Help & Support" }} />
      <Drawer.Screen
        name="transactions"
        options={{ title: "Light Transaction" }}
      />
      <Drawer.Screen name="logout" options={{ title: "Logout" }} />
    </Drawer>
  );
}
