import { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";

type DrawerPageProps = PropsWithChildren<{
  subtitle?: string;
  title: string;
}>;

export function DrawerPage({ children, subtitle, title }: DrawerPageProps) {
  return (
    <AppContainer>
      <Box style={styles.screen}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </Box>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: astroColors.white,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 38,
    lineHeight: 46,
    textAlign: "center",
  },
  subtitle: {
    color: astroColors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 17,
    lineHeight: 25,
    marginTop: 10,
    textAlign: "center",
  },
});
