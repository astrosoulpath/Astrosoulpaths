import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";

type RouteItem = {
  description: string;
  href:
    | "/(auth)/login"
    | "/(auth)/otp"
    | "/(drawer)"
    | "/(drawer)/audio-call"
    | "/(drawer)/profile"
    | "/(drawer)/settings"
    | "/(drawer)/support"
    | "/(drawer)/transactions"
    | "/(drawer)/logout";
  title: string;
};

const routeGroups: { items: RouteItem[]; title: string }[] = [
  {
    title: "Entry",
    items: [
      {
        title: "Drawer Home",
        href: "/(drawer)",
        description: "Open the astrologer home screen inside the drawer flow.",
      },
    ],
  },
  {
    title: "Auth",
    items: [
      {
        title: "Login",
        href: "/(auth)/login",
        description: "Phone number login screen.",
      },
      {
        title: "OTP",
        href: "/(auth)/otp",
        description: "OTP verification screen.",
      },
    ],
  },
  {
    title: "Drawer Pages",
    items: [
      {
        title: "Audio Call",
        href: "/(drawer)/audio-call",
        description: "ZEGO audio call testing screen.",
      },
      {
        title: "Profile",
        href: "/(drawer)/profile",
        description: "Astrologer profile screen.",
      },
      {
        title: "Settings",
        href: "/(drawer)/settings",
        description: "Settings screen.",
      },
      {
        title: "Support",
        href: "/(drawer)/support",
        description: "Help and support screen.",
      },
      {
        title: "Transactions",
        href: "/(drawer)/transactions",
        description: "Transaction history screen.",
      },
      {
        title: "Logout",
        href: "/(drawer)/logout",
        description: "Logout confirmation screen.",
      },
    ],
  },
];

export default function RoutesScreen() {
  return (
    <AppContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Route Page</Text>
        <Text style={styles.title}>Open any screen directly</Text>
        <Text style={styles.subtitle}>
          This page is now the app entry route so you can jump straight into any
          screen while building and testing.
        </Text>

        {routeGroups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>

            {group.items.map((item) => (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.card,
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDescription}>{item.description}</Text>
                  <Text style={styles.cardPath}>{item.href}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ))}
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    color: astroColors.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: astroColors.white,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    lineHeight: 40,
    marginTop: 10,
  },
  subtitle: {
    color: astroColors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  group: {
    marginTop: 22,
  },
  groupTitle: {
    color: astroColors.goldBright,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "rgba(11, 20, 51, 0.92)",
    borderColor: "rgba(212, 167, 87, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  cardTitle: {
    color: astroColors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
  },
  cardDescription: {
    color: astroColors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  cardPath: {
    color: astroColors.gold,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
});
