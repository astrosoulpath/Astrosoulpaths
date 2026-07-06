import { PermissionsAndroid, Platform } from "react-native";

import { createLogger } from "@/src/lib/logger";

const logger = createLogger("MicrophonePermission");

export async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const alreadyGranted = await PermissionsAndroid.check(permission);

  if (alreadyGranted) {
    logger.debug("Microphone permission already granted");
    return true;
  }

  const result = await PermissionsAndroid.request(permission, {
    buttonNegative: "Deny",
    buttonPositive: "Allow",
    message: "Astroologers needs microphone access for ZEGO audio calls.",
    title: "Microphone permission",
  });

  const granted = result === PermissionsAndroid.RESULTS.GRANTED;

  logger.info("Microphone permission result", { granted, result });

  return granted;
}
