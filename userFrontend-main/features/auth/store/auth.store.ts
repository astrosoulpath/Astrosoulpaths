import { setApiAccessToken } from "@/lib/api/axios";
import { mapSupabaseSessionToAuthSession } from "@/lib/supabase/client";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { debugSessionSnapshot } from "../../../lib/api/auth-debug";
import { AuthNextStep, AuthSession, AuthUser } from "../api/auth.types";
import { secureStateStorage } from "./auth.storage";

function isSessionExpired(session: AuthSession | null) {
  if (!session?.expiresAt) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds =
    session.expiresAt > 1_000_000_000_000
      ? Math.floor(session.expiresAt / 1000)
      : session.expiresAt;

  return expiresAtSeconds <= nowSeconds;
}

type AuthStatus = "anonymous" | "authenticated";

type AuthStoreState = {
  hydrated: boolean;
  status: AuthStatus;
  pendingPhone: string | null;
  nextStep: AuthNextStep | null;
  user: AuthUser | null;
  session: AuthSession | null;
  markHydrated: () => void;
  setPendingPhone: (phone: string | null) => void;
  setNextStep: (nextStep: AuthNextStep | null) => void;
  setUser: (user: AuthUser | null) => void;
  setSession: (payload: {
    user: AuthUser;
    session: AuthSession;
    nextStep?: AuthNextStep | null;
  }) => void;
  syncSupabaseSession: (session: SupabaseSession | null) => void;
  clearPendingPhone: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      hydrated: false,
      status: "anonymous",
      pendingPhone: null,
      nextStep: null,
      user: null,
      session: null,

      markHydrated: () => {
        set({ hydrated: true });
      },

      setPendingPhone: (phone) => {
        set({ pendingPhone: phone });
      },

      setNextStep: (nextStep) => {
        set({ nextStep });
      },

      setUser: (user) => {
        set((state) => ({
          user,
          status: user && state.session ? "authenticated" : state.status,
        }));
      },

      setSession: ({ user, session, nextStep = null }) => {
        setApiAccessToken(session.accessToken);
        debugSessionSnapshot("[AuthStore] setSession", session, {
          userId: user.id,
          phone: user.phone,
        });
        set({
          nextStep,
          user,
          session,
          status: "authenticated",
        });
      },

      syncSupabaseSession: (supabaseSession) => {
        debugSessionSnapshot(
          "[AuthStore] syncSupabaseSession",
          supabaseSession,
          {
            hasUser: Boolean(useAuthStore.getState().user),
          },
        );

        const nextSession = mapSupabaseSessionToAuthSession(supabaseSession);

        if (!nextSession || isSessionExpired(nextSession)) {
          setApiAccessToken(null);
          set((state) => {
            if (
              state.status === "anonymous" &&
              !state.user &&
              !state.session &&
              !state.pendingPhone
            ) {
              return state;
            }

            return {
              status: "anonymous",
              nextStep: null,
              user: null,
              session: null,
              pendingPhone: null,
            };
          });
          return;
        }

        setApiAccessToken(nextSession.accessToken);
        set((state) => ({
          session: nextSession,
          status: state.user ? "authenticated" : state.status,
        }));
      },

      clearPendingPhone: () => {
        set({ pendingPhone: null });
      },

      logout: () => {
        setApiAccessToken(null);
        set({
          status: "anonymous",
          nextStep: null,
          user: null,
          session: null,
          pendingPhone: null,
        });
      },
    }),
    {
      name: "auth-session-store",
      storage: createJSONStorage(() => secureStateStorage),
      partialize: (state) => ({
        status: state.status,
        pendingPhone: state.pendingPhone,
        nextStep: state.nextStep,
        user: state.user,
        session: state.session,
      }),
      onRehydrateStorage: () => (state) => {
        debugSessionSnapshot("[AuthStore] rehydrate snapshot", state?.session, {
          hydrated: state?.hydrated,
          status: state?.status,
        });

        if (state?.session?.accessToken && !isSessionExpired(state.session)) {
          setApiAccessToken(state.session.accessToken);
        } else if (state) {
          state.status = "anonymous";
          state.nextStep = null;
          state.user = null;
          state.session = null;
          state.pendingPhone = null;
          setApiAccessToken(null);
        }
        state?.markHydrated();
      },
    },
  ),
);
