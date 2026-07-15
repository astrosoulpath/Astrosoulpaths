import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearAuthSession,
  isSessionExpired,
  readAuthSession,
  saveAuthSession,
} from "./auth.storage";

import {
  sendOtp as sendOtpRequest,
  verifyOtp as verifyOtpRequest,
} from "./auth.service";

import type {
  AuthContextValue,
  AuthStatus,
  SendOtpPayload,
  SendOtpResponse,
  StoredAuthSession,
  VerifyOtpPayload,
} from "./auth.types";

export const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

AuthContext.displayName =
  "AuthContext";

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const [status, setStatus] =
    useState<AuthStatus>("loading");

  const [session, setSession] =
    useState<StoredAuthSession | null>(
      null,
    );

  const restoreSession =
    useCallback(
      async (): Promise<void> => {
        try {
          setStatus("loading");

          const storedSession =
            await readAuthSession();

          if (!storedSession) {
            setSession(null);
            setStatus(
              "unauthenticated",
            );
            return;
          }

          if (
            isSessionExpired(
              storedSession,
            )
          ) {
            await clearAuthSession();

            setSession(null);
            setStatus(
              "unauthenticated",
            );
            return;
          }

          setSession(
            storedSession,
          );

          setStatus(
            "authenticated",
          );
        } catch {
          await clearAuthSession();

          setSession(null);

          setStatus(
            "unauthenticated",
          );
        }
      },
      [],
    );

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const sendOtp =
    useCallback(
      async (
        payload: SendOtpPayload,
      ): Promise<SendOtpResponse> => {
        return sendOtpRequest(
          payload,
        );
      },
      [],
    );

  const verifyOtp =
    useCallback(
      async (
        payload: VerifyOtpPayload,
      ): Promise<StoredAuthSession> => {
        const newSession =
          await verifyOtpRequest(
            payload,
          );

        await saveAuthSession(
          newSession,
        );

        setSession(
          newSession,
        );

        setStatus(
          "authenticated",
        );

        return newSession;
      },
      [],
    );

  const signOut =
    useCallback(
      async (): Promise<void> => {
        await clearAuthSession();

        setSession(null);

        setStatus(
          "unauthenticated",
        );
      },
      [],
    );

  const value =
    useMemo<AuthContextValue>(
      () => ({
        status,

        session,

        user:
          session?.user ?? null,

        loading:
          status === "loading",

        authenticated:
          status ===
          "authenticated",

        sendOtp,

        verifyOtp,

        restoreSession,

        signOut,
      }),
      [
        status,
        session,
        sendOtp,
        verifyOtp,
        restoreSession,
        signOut,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}