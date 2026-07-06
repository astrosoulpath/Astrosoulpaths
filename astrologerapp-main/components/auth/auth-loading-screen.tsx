import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";

type AuthLoadingScreenProps = {
  message?: string;
};

export function AuthLoadingScreen({
  message = "Checking your session...",
}: AuthLoadingScreenProps) {
  return (
    <AppContainer>
      <View style={styles.root}>
        <ActivityIndicator color={astroColors.gold} size="large" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  message: {
    color: astroColors.white,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    textAlign: "center",
  },
});
