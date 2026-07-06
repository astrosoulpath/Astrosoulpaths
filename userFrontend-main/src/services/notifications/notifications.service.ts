import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const OTP_SUCCESS_CHANNEL_ID = "auth-events";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function hasNotificationPermission(
  settings: Notifications.NotificationPermissionsStatus,
) {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function initializeNotifications() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(OTP_SUCCESS_CHANNEL_ID, {
    name: "Account updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 150, 200],
    lightColor: "#F4C56D",
  });
}

export async function sendOtpVerifiedNotification() {
  if (Platform.OS === "web") {
    return false;
  }

  await initializeNotifications();

  const currentSettings = await Notifications.getPermissionsAsync();
  const finalSettings = hasNotificationPermission(currentSettings)
    ? currentSettings
    : await Notifications.requestPermissionsAsync();

  if (!hasNotificationPermission(finalSettings)) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Welcome to Astro Soul Path",
      body: "Your number is verified. Step into your cosmic path with fresh insights, remedies, and guidance made for you.",
      data: {
        type: "otp_verified",
      },
    },
    trigger: null,
  });

  return true;
}
