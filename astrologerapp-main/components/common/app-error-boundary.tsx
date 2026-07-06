import { LinearGradient } from "expo-linear-gradient";
import { RefreshCcw } from "lucide-react-native";
import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { astroColors } from "@/src/constants/colors";
import { createLogger } from "@/src/lib/logger";

const logger = createLogger("app-error-boundary");

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <Box style={styles.screen}>
      <LinearGradient
        colors={["#020817", "#081028", "#0B1433"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.description}>
          The app hit an unexpected error. You can retry safely from here.
        </Text>

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <RefreshCcw color={astroColors.white} size={16} strokeWidth={2.2} />
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    </Box>
  );
}

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundaryRoot extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError() {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("App boundary caught an error", {
      componentStack: info.componentStack,
      message: error.message,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: PropsWithChildren) {
  return <AppErrorBoundaryRoot>{children}</AppErrorBoundaryRoot>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: astroColors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    color: astroColors.white,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
  },
  description: {
    marginTop: 12,
    color: astroColors.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(63, 59, 255, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(109, 82, 255, 0.42)",
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: astroColors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
