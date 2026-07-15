import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>
          ✦
        </Text>
      </View>

      <Text style={styles.title}>
        Astro Soul Path
      </Text>

      <Text style={styles.subtitle}>
        Preparing your spiritual journey...
      </Text>

      <ActivityIndicator
        size="large"
        color="#D4AF37"
        style={styles.loader}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FAF7F0",
      paddingHorizontal: 24,
    },

    logoContainer: {
      width: 88,
      height: 88,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 44,
      backgroundColor: "#0B1026",
    },

    logo: {
      color: "#D4AF37",
      fontSize: 42,
      fontWeight: "700",
    },

    title: {
      marginTop: 24,
      color: "#0B1026",
      fontSize: 30,
      fontWeight: "700",
    },

    subtitle: {
      marginTop: 10,
      color: "#667085",
      fontSize: 15,
      textAlign: "center",
    },

    loader: {
      marginTop: 32,
    },
  });