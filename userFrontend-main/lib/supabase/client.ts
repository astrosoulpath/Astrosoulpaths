import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createClient,
  type Session as SupabaseSession,
} from "@supabase/supabase-js";
import { debugSessionSnapshot } from "../api/auth-debug";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_KEY
)?.trim();

if (!supabaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_KEY) environment variable",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: "astro-auth-session",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
  db: {
    schema: "public",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type BackendSessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
};

function normalizeExpiresAt(expiresAt?: number | null) {
  if (!expiresAt) {
    return null;
  }

  return expiresAt > 1_000_000_000_000
    ? Math.floor(expiresAt / 1000)
    : expiresAt;
}

export function isSupabaseSessionExpired(
  session: SupabaseSession | null | undefined,
) {
  const expiresAt = normalizeExpiresAt(session?.expires_at);
  if (!expiresAt) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowSeconds;
}

export function mapSupabaseSessionToAuthSession(
  session: SupabaseSession | null | undefined,
) {
  if (!session?.access_token || !session?.refresh_token) {
    return null;
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in || 0,
    expiresAt: normalizeExpiresAt(session.expires_at) || 0,
    tokenType: session.token_type || "bearer",
  };
}

export async function getValidSupabaseAccessToken(options?: {
  refreshIfExpired?: boolean;
  reason?: string;
}) {
  const refreshIfExpired = options?.refreshIfExpired ?? true;
  const reason = options?.reason || "unknown";

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    if (__DEV__) {
      console.warn("[Supabase] getSession failed while resolving socket auth", {
        reason,
        message: error.message,
      });
    }

    return {
      token: null,
      session: null,
      expired: true,
    };
  }

  let resolvedSession = session;

  debugSessionSnapshot("[Supabase] getSession for token resolution", session, {
    reason,
  });

  if (
    resolvedSession &&
    isSupabaseSessionExpired(resolvedSession) &&
    refreshIfExpired
  ) {
    if (__DEV__) {
      console.log("[Supabase] refreshing expired session before socket auth", {
        reason,
      });
    }

    const { data: refreshedData, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshError) {
      if (__DEV__) {
        console.warn(
          "[Supabase] refreshSession failed while resolving socket auth",
          {
            reason,
            message: refreshError.message,
          },
        );
      }
    } else {
      resolvedSession = refreshedData.session;
      debugSessionSnapshot(
        "[Supabase] refreshSession result",
        resolvedSession,
        {
          reason,
        },
      );
    }
  }

  const expired = isSupabaseSessionExpired(resolvedSession);
  const token = expired ? null : resolvedSession?.access_token?.trim() || null;

  return {
    token,
    session: resolvedSession,
    expired,
  };
}

export async function setSupabaseSessionFromBackend(
  session: BackendSessionPayload,
) {
  debugSessionSnapshot("[Supabase] setSession input", session);

  if (!session?.accessToken || !session?.refreshToken) {
    throw new Error(
      "Invalid session payload: accessToken/refreshToken required",
    );
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  if (error) {
    throw error;
  }

  debugSessionSnapshot("[Supabase] setSession result", data.session);

  const { data: restoredSession, error: getSessionError } =
    await supabase.auth.getSession();

  if (getSessionError) {
    if (__DEV__) {
      console.warn("[Supabase] getSession after setSession failed", {
        message: getSessionError.message,
      });
    }
  } else {
    debugSessionSnapshot(
      "[Supabase] getSession after setSession",
      restoredSession.session,
    );
  }

  return data.session;
}
