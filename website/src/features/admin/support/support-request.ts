"use client";
import { getAdminApiBase } from "../auth/admin-contract";
import { refreshAdminSession } from "../auth/admin-session";
const responseOwners = new WeakMap<Response, string>();

export async function readSupportResponse(response: Response) {
  const owner = responseOwners.get(response);
  if (
    !owner ||
    owner !== localStorage.getItem("asp_admin_firebase_uid") ||
    !localStorage.getItem("asp_admin_access_token")
  )
    throw new Error("Admin session changed");
  const data = await response.json().catch(() => null);
  if (
    owner !== localStorage.getItem("asp_admin_firebase_uid") ||
    !localStorage.getItem("asp_admin_access_token")
  )
    throw new Error("Admin session changed");
  return data;
}

export async function supportFetch(path: string, init: RequestInit = {}) {
  if (!/^\/admin\/(support|feedback)(\/|\?|$)/.test(path))
    throw new Error("Invalid support destination");
  const identity = localStorage.getItem("asp_admin_firebase_uid"),
    token = await refreshAdminSession();
  if (!identity || identity !== localStorage.getItem("asp_admin_firebase_uid"))
    throw new Error("Admin session changed");
  const response = await fetch(getAdminApiBase() + path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15000),
    cache: "no-store",
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (
    identity !== localStorage.getItem("asp_admin_firebase_uid") ||
    !localStorage.getItem("asp_admin_access_token")
  )
    throw new Error("Admin session changed");
  if (response.status === 401 || response.status === 403)
    throw new Error(
      "Admin authorization expired or access denied. Sign in again.",
    );
  responseOwners.set(response, identity);
  return response;
}

export async function supportRequest(path: string, init: RequestInit = {}) {
  if (!/^\/admin\/(support|feedback)(\/|\?|$)/.test(path))
    throw new Error("Invalid support destination");
  const identity = localStorage.getItem("asp_admin_firebase_uid");
  const token = await refreshAdminSession();
  if (!identity || identity !== localStorage.getItem("asp_admin_firebase_uid"))
    throw new Error("Admin account changed");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(getAdminApiBase() + path, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        ...init.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => null);
    if (
      identity !== localStorage.getItem("asp_admin_firebase_uid") ||
      !localStorage.getItem("asp_admin_access_token")
    )
      throw new Error("Admin session changed");
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "Admin authorization expired or access denied. Sign in again.",
      );
    if (!response.ok)
      throw new Error(
        typeof data?.message === "string"
          ? data.message
          : "Support request failed",
      );
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}
