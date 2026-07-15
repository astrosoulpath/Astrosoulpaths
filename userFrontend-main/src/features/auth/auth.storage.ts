import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  StoredAuthSession,
} from "./auth.types";

const AUTH_STORAGE_KEY =
  "asp.user.auth.session";

export async function saveAuthSession(
  session: StoredAuthSession,
): Promise<void> {
  await AsyncStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session),
  );
}

export async function readAuthSession(): Promise<StoredAuthSession | null> {
  const rawSession =
    await AsyncStorage.getItem(
      AUTH_STORAGE_KEY,
    );

  if (!rawSession) {
    return null;
  }

  try {
    const session =
      JSON.parse(
        rawSession,
      ) as StoredAuthSession;

    if (
      !session ||
      typeof session !== "object" ||
      typeof session.accessToken !==
        "string" ||
      !session.accessToken.trim()
    ) {
      await clearAuthSession();
      return null;
    }

    return {
      accessToken:
        session.accessToken.trim(),

      refreshToken:
        typeof session.refreshToken ===
          "string" &&
        session.refreshToken.trim()
          ? session.refreshToken.trim()
          : null,

      expiresAt:
        typeof session.expiresAt ===
          "number" &&
        Number.isFinite(
          session.expiresAt,
        )
          ? session.expiresAt
          : null,

      nextStep:
        typeof session.nextStep ===
          "string" &&
        session.nextStep.trim()
          ? session.nextStep.trim()
          : null,

      user:
        session.user ?? null,
    };
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session =
    await readAuthSession();

  return session?.accessToken ?? null;
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(
    AUTH_STORAGE_KEY,
  );
}

export function isSessionExpired(
  session: StoredAuthSession,
): boolean {
  if (!session.expiresAt) {
    return false;
  }

  const currentTimeInSeconds =
    Math.floor(Date.now() / 1000);

  return (
    session.expiresAt <=
    currentTimeInSeconds
  );
}