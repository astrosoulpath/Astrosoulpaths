import AsyncStorage from "@react-native-async-storage/async-storage";

import { StoredAuthSession } from "@/src/features/auth/auth.types";
import { createLogger } from "@/src/lib/logger";

const logger = createLogger("auth-storage");
const AUTH_STORAGE_KEY = "astrologer.auth.session";

export async function saveAuthSession(session: StoredAuthSession) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  logger.info("Auth session saved to AsyncStorage", {
    hasAccessToken: Boolean(session.accessToken),
    nextStep: session.nextStep,
    storedKey: AUTH_STORAGE_KEY,
  });
}

export async function readAuthSession() {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    logger.info("No auth session found in AsyncStorage", {
      storedKey: AUTH_STORAGE_KEY,
    });
    return null;
  }

  try {
    const session = JSON.parse(raw) as StoredAuthSession;

    logger.info("Auth session restored from AsyncStorage", {
      hasAccessToken: Boolean(session.accessToken),
      nextStep: session.nextStep,
      storedKey: AUTH_STORAGE_KEY,
    });

    return session;
  } catch (error) {
    logger.warn("Failed to parse stored auth session", error);
    await clearAuthSession();
    return null;
  }
}

export async function clearAuthSession() {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  logger.info("Cleared auth session from AsyncStorage", {
    storedKey: AUTH_STORAGE_KEY,
  });
}
