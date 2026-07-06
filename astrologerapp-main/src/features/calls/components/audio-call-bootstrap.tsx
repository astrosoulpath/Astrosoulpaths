import { useEffect } from "react";
import { AppState } from "react-native";

import { audioCallController } from "@/src/features/calls/services/audio-call-controller";

export function AudioCallBootstrap() {
  useEffect(() => {
    void audioCallController.start();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      void audioCallController.handleAppStateChange(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}