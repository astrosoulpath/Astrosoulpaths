import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native";
import { memo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { astroColors } from "@/src/constants/colors";
import { useAuth } from "@/src/features/auth/auth-provider";

function DrawerFooterComponent() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    try {
      setIsSubmitting(true);
      await logout();
      router.replace("/(auth)/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <VStack style={styles.root}>
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={() => void handleLogout()}
        style={({ pressed }) => [
          styles.logoutButton,
          isSubmitting ? styles.logoutButtonDisabled : null,
          pressed ? styles.logoutButtonPressed : null,
        ]}
      >
        <LogOut color={astroColors.gold} size={18} strokeWidth={2.1} />
        <Text style={styles.logoutText}>
          {isSubmitting ? "Logging out..." : "Logout"}
        </Text>
      </Pressable>

      <Text style={styles.version}>Version 1.0.0</Text>
    </VStack>
  );
}

export const AppDrawerFooter = memo(DrawerFooterComponent);

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  logoutButton: {
    alignItems: "center",
    borderColor: "rgba(212,167,87,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  logoutButtonDisabled: {
    opacity: 0.56,
  },
  logoutButtonPressed: {
    opacity: 0.78,
  },
  logoutText: {
    color: astroColors.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  version: {
    color: "rgba(182,184,214,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 22,
  },
});
