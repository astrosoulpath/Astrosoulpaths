"use client";

import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebaseClient";
import { getAdminApiBase } from "./admin-contract";

type AdminUser = {
  id?: string;
  email?: string;
  role?: string;
  portal?: string;
};
let epoch = 0;
let stopped = false;
let pending: Promise<unknown> = Promise.resolve();
let renewal: Promise<string> | null = null;

function clearAdminStorage() {
  [
    "asp_admin_access_token",
    "asp_admin_refresh_token",
    "asp_admin_user",
    "asp_admin_auth_method",
    "asp_admin_firebase_uid",
    "asp_admin_login_method",
  ].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  sessionStorage.removeItem("admin_phone");
  sessionStorage.removeItem("admin_firebase_verification_id");
  window.dispatchEvent(new Event("asp-auth-changed"));
}

export function establishAdminSession(
  token: string,
  method: "google" | "password" | "existing",
  user?: AdminUser,
  authMethod: "firebase" | "email" = "firebase",
  refreshToken?: string,
) {
  const generation = epoch;
  const firebaseUid =
    authMethod === "firebase" ? firebaseAuth.currentUser?.uid : undefined;
  const operation = pending
    .catch(() => undefined)
    .then(async () => {
      if (stopped || generation !== epoch)
        throw new Error("Admin sign-in was cancelled.");
      if (
        authMethod === "firebase" &&
        (!firebaseUid || firebaseAuth.currentUser?.uid !== firebaseUid)
      )
        throw new Error("Firebase account changed. Please sign in again.");
      const response = await fetch("/api/admin/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token, method }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "Admin access denied.");
      if (stopped || generation !== epoch || firebaseAuth.currentUser?.uid !== firebaseUid)
        throw new Error("Admin sign-in was cancelled.");
      if(typeof result.accessToken !== 'string' || !result.accessToken.startsWith('aspctx.')) throw new Error('Secure Admin context was not established.');
      localStorage.setItem("asp_admin_access_token", result.accessToken);
      if(method !== 'existing')localStorage.setItem('asp_admin_login_method',method);
      localStorage.setItem("asp_admin_auth_method", authMethod);
      if (firebaseUid)
        localStorage.setItem("asp_admin_firebase_uid", firebaseUid);
      else localStorage.removeItem("asp_admin_firebase_uid");
      if (refreshToken)
        localStorage.setItem("asp_admin_refresh_token", refreshToken);
      else localStorage.removeItem("asp_admin_refresh_token");
      const verifiedUser = result.user ?? user;
      if (verifiedUser)
        localStorage.setItem(
          "asp_admin_user",
          JSON.stringify({ ...verifiedUser, role: "ADMIN", portal: "admin" }),
        );
      window.dispatchEvent(new Event("asp-auth-changed"));
      return result.accessToken as string;
    });
  pending = operation;
  return operation;
}

export async function beginAdminLogin() {
  // Fence refreshes and remove the previous routing session before account selection.
  stopped = true;
  epoch++;
  await pending.catch(() => undefined);
  const response = await fetch("/api/admin/session", {
    method: "DELETE",
    credentials: "same-origin",
  });
  clearAdminStorage();
  if (!response.ok)
    throw new Error(
      "Unable to clear the previous Admin session. Please retry.",
    );
  stopped = false;
}

export function refreshAdminSession(): Promise<string> {
  if (renewal) return renewal;
  const generation = epoch;
  renewal = (async () => {
    if (stopped) throw new Error("Admin session ended.");
    const storedToken = localStorage.getItem("asp_admin_access_token");
    if (!storedToken) throw new Error("Please sign in as Admin.");
    const authMethod = localStorage.getItem("asp_admin_auth_method");
    let token = storedToken;
    const refreshToken: string | undefined = undefined;
    if (authMethod === "firebase") {
      await firebaseAuth.authStateReady();
      if (!firebaseAuth.currentUser)
        throw new Error("Firebase session expired. Please sign in again.");
      if (
        firebaseAuth.currentUser.uid !==
        localStorage.getItem("asp_admin_firebase_uid")
      )
        throw new Error("Firebase account changed. Please sign in again.");
      // The SDK refreshes near expiry. Forcing a refresh here would cause
      // onIdTokenChanged -> restore -> forced refresh loops.
      token = await firebaseAuth.currentUser.getIdToken();
    } else
      throw new Error(
        "Please sign in again to establish a secure Admin session.",
      );
    if (stopped || generation !== epoch)
      throw new Error("Admin session ended.");
    return establishAdminSession(
      token,
      localStorage.getItem('asp_admin_login_method') === 'password' ? 'password' : 'google',
      undefined,
      authMethod,
      refreshToken,
    );
  })().finally(() => {
    renewal = null;
  });
  return renewal;
}

export async function logoutAdmin() {
  stopped = true;
  epoch++;
  // A late refresh cannot re-create the cookie after this DELETE.
  await pending.catch(() => undefined);
  let failure: unknown;
  try {
    await signOut(firebaseAuth);
  } catch (error) {
    failure = error;
  }
  try {
    const response = await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Server logout failed. Please retry.");
  } catch (error) {
    failure = error;
  } finally {
    clearAdminStorage();
  }
  if (failure)
    throw new Error(
      "Logout could not finish. Please retry before leaving this device.",
    );
}

export async function adminFetch(path: string, init: RequestInit = {}) {
  const token = await refreshAdminSession();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAdminApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    await logoutAdmin();
    window.location.replace("/admin/login");
    throw new Error("Admin session expired or access denied.");
  }
  return response;
}
