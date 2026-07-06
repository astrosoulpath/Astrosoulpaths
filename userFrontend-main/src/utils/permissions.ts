import { PermissionsAndroid, Platform } from "react-native";

export type MicrophonePermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

export async function ensureMicrophonePermission(): Promise<MicrophonePermissionResult> {
  if (Platform.OS === "web") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unavailable",
    };
  }

  if (Platform.OS === "android") {
    const current = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );

    if (current) {
      return {
        granted: true,
        canAskAgain: true,
        status: "granted",
      };
    }

    const requested = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone permission",
        message: "Allow microphone access for astrology audio calling.",
        buttonPositive: "Allow",
        buttonNegative: "Deny",
      },
    );

    const granted = requested === PermissionsAndroid.RESULTS.GRANTED;

    return {
      granted,
      canAskAgain: requested !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      status: requested,
    };
  }

  const { Audio } = await import("expo-av");
  const current = await Audio.getPermissionsAsync();

  if (current.granted) {
    return {
      granted: true,
      canAskAgain: current.canAskAgain,
      status: current.status,
    };
  }

  const requested = await Audio.requestPermissionsAsync();

  return {
    granted: requested.granted,
    canAskAgain: requested.canAskAgain,
    status: requested.status,
  };
}
