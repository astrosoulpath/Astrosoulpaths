let authVersion = 0;
function publicOwnerSnapshot() {
  return JSON.stringify([
    localStorage.getItem("asp_user"),
    localStorage.getItem("asp_customer_access_token"),
    localStorage.getItem("asp_access_token"),
    localStorage.getItem("asp_astrologer_access_token"),
  ]);
}
export function beginPublicAuthAttempt() {
  const version = ++authVersion,
    owner = publicOwnerSnapshot();
  return () => version === authVersion && owner === publicOwnerSnapshot();
}
export type Portal = "customer" | "astrologer";
export type SessionResult = {
  success?: boolean;
  portal?: string;
  role?: string;
  nextStep?: string;
  accessToken?: string;
  session?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    expiresIn?: number;
  };
  user?: Record<string, unknown>;
  astrologer?: Record<string, unknown>;
};
export function publicAuthBase(value = process.env.NEXT_PUBLIC_API_BASE_URL) {
  if (!value) throw Error("Sign-in is temporarily unavailable.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw Error("Sign-in is temporarily unavailable.");
  return value.replace(/\/+$/, "");
}
export function safeCustomerRedirect(value: unknown, fallback = "/dashboard") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n\u0000-\u001f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://local.invalid");
    if (
      url.origin !== "https://local.invalid" ||
      (/^\/(admin|astrologer)(\/|$)/i.test(decodeURIComponent(url.pathname)) &&
        url.pathname !== "/astrologer/register")
    )
      return fallback;
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.startsWith("//") || /[\\\r\n\u0000-\u001f]/.test(decoded))
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
export function destinationFor(
  result: SessionResult,
  portal: Portal,
  returnTo?: string,
) {
  if (portal === "customer" && returnTo === "/astrologer/register")
    return returnTo;
  if (portal === "customer")
    return result.nextStep === "COMPLETE_PROFILE"
      ? "/profile/complete"
      : safeCustomerRedirect(returnTo);
  if (
    result.nextStep === "OPEN_ASTROLOGER_DASHBOARD" &&
    result.role === "ASTROLOGER"
  )
    return "/astrologer/dashboard";
  if (result.nextStep === "WAIT_FOR_ADMIN_APPROVAL")
    return "/astrologer/pending";
  return "/astrologer/onboarding";
}
export async function publicAuthRequest(
  path: string,
  body: object,
): Promise<SessionResult> {
  if (
    ![
      "/auth/email/signup",
      "/auth/email/login",
      "/auth/firebase/google",
      "/auth/firebase/email",
    ].includes(path)
  )
    throw Error("Unsupported sign-in method.");
  let response: Response;
  try {
    response = await fetch(publicAuthBase() + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw Error(
      "The sign-in service could not be reached. Check your connection. If you were creating an account, check for its verification email before retrying.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    const code = result?.code;
    throw Error(
      response.status === 429
        ? "Too many attempts. Please wait before retrying."
        : code === "EMAIL_ALREADY_REGISTERED"
          ? "This email already has an account. Sign in instead."
          : code === "EMAIL_NOT_VERIFIED"
            ? "Verify your email before signing in."
            : code === "FIREBASE_GOOGLE_LINK_REQUIRED" ||
                code === "ACCOUNT_LINK_CONFIRMATION_REQUIRED"
              ? "This account requires the existing secure account-linking process. Contact support; no accounts have been merged."
              : response.status === 401 || response.status === 403
                ? "Sign-in was not authorized. Check your account and selected sign-in method."
                : "Sign-in could not be completed. Check your connection and retry.",
    );
  }
  return result;
}
const privateKeys = [
  "asp_active_call",
  "asp_pending_consultation",
  "asp_free_chat_popup_pending",
  "asp_after_profile_redirect",
];
export function commitPortalSession(result: SessionResult, portal: Portal, announce = true) {
  const token = result.session?.accessToken ?? result.accessToken;
  const user = result.user;
  const expected =
    portal === "customer"
      ? ["CUSTOMER"]
      : ["ASTROLOGER", "ASTROLOGER_APPLICANT"];
  if (
    result.success !== true ||
    result.portal !== portal ||
    !expected.includes(result.role ?? "") ||
    !token ||
    !user ||
    typeof user.id !== "string" ||
    !user.id ||
    user.portal !== portal ||
    !expected.includes(String(user.role))
  )
    throw Error("The server did not authorize the selected account context.");
  if (announce) authVersion++;
  const previous = localStorage.getItem("asp_user");
  if (previous !== JSON.stringify(user)) {
    for (const key of privateKeys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }
  const prefix = portal === "customer" ? "asp_customer" : "asp_astrologer";
  localStorage.setItem(prefix + "_access_token", token);
  const expiry = result.session?.expiresAt;
  if (Number.isSafeInteger(expiry) && Number(expiry) > Date.now() / 1000)
    localStorage.setItem(prefix + "_expires_at", String(expiry));
  else localStorage.removeItem(prefix + "_expires_at");
  // Renewal uses the original provider proof; unused long-lived ASP refresh copies are not persisted.
  localStorage.removeItem(prefix+"_refresh_token");
  localStorage.setItem(prefix + "_user", JSON.stringify(user));
  localStorage.setItem("asp_user", JSON.stringify(user));
  if (portal === "customer") {
    localStorage.setItem("asp_access_token", token);
    localStorage.removeItem("asp_refresh_token");
  } else {
    localStorage.removeItem("asp_access_token");
    localStorage.removeItem("asp_refresh_token");
  }
  const hint = {
    portal,
    role: result.role,
    astrologerStatus:
      portal === "astrologer"
        ? result.nextStep === "OPEN_ASTROLOGER_DASHBOARD"
          ? "APPROVED"
          : result.nextStep === "WAIT_FOR_ADMIN_APPROVAL"
            ? "PENDING_APPROVAL"
            : "ONBOARDING"
        : undefined,
    isAstrologer: portal === "astrologer",
  };
  document.cookie =
    "asp_user=" +
    encodeURIComponent(JSON.stringify(hint)) +
    "; path=/; max-age=86400; SameSite=Lax" +
    (window.location?.protocol === "https:" ? "; Secure" : "");
  if (announce) window.dispatchEvent(new Event("asp-auth-changed"));
}
export type NavigationSession = {
  firebaseUid?: string;
  id: string;
  portal: Portal;
  role: string;
  nextStep: string;
  name: string;
};
export function sessionCandidate(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  try {
    const descriptor = JSON.parse(localStorage.getItem("asp_user") || "{}");
    const portal: Portal = pathname.startsWith("/astrologer/")
      ? "astrologer"
      : descriptor.portal === "astrologer"
        ? "astrologer"
        : "customer";
    if (descriptor.portal && descriptor.portal !== portal) return null;
    const token =
      portal === "customer"
        ? localStorage.getItem("asp_customer_access_token") ||
          localStorage.getItem("asp_access_token")
        : localStorage.getItem("asp_astrologer_access_token");
    if (!token) return null;
    return {
      portal,
      token,
      snapshot: JSON.stringify([
        portal,
        token,
        localStorage.getItem("asp_user"),
      ]),
    };
  } catch {
    return null;
  }
}
export async function verifyNavigationSession(
  pathname: string,
  signal: AbortSignal,
): Promise<NavigationSession | null> {
  const generation = authVersion;
  let owner = sessionCandidate(pathname);
  if (!owner) return null;
  const expiry = Number(localStorage.getItem(`asp_${owner.portal}_expires_at`));
  if (owner.token.startsWith("aspctx.") && expiry > 0 && expiry <= Date.now() / 1000 + 30) {
    await renewPublicSession(pathname, owner.snapshot, generation);
    if (signal.aborted) throw Error("Session verification cancelled.");
    owner = sessionCandidate(pathname);
    if (!owner) return null;
  }
  const read = (candidate: NonNullable<typeof owner>) => fetch(
    publicAuthBase() + "/user/session?portal=" + candidate.portal,
    {
      headers: { Authorization: "Bearer " + candidate.token },
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    },
  );
  let r = await read(owner);
  if (generation !== authVersion) throw Error("Account changed.");
  // Only authentication expiry may renew. A permission denial is never retried
  // through another portal or promoted into a different role.
  if (r.status === 401 && owner.token.startsWith("aspctx.")) {
    await renewPublicSession(pathname, owner.snapshot, generation);
    if (signal.aborted) throw Error("Session verification cancelled.");
    owner = sessionCandidate(pathname);
    if (!owner) return null;
    r = await read(owner);
  }
  const data = await r.json().catch(() => null);
  if (sessionCandidate(pathname)?.snapshot !== owner.snapshot)
    throw Error("Account changed.");
  // Only an explicit authentication rejection means the visitor must sign in.
  // Outages, throttling and invalid responses must not masquerade as expiry.
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) throw Error("Session verification is temporarily unavailable.");
  if (
    !r.ok ||
    data?.success !== true ||
    data.portal !== owner.portal ||
    typeof data.user?.id !== "string"
  )
    throw Error("The session verification response could not be validated.");
  const roles =
    owner.portal === "customer"
      ? ["CUSTOMER"]
      : ["ASTROLOGER", "ASTROLOGER_APPLICANT"];
  if (!roles.includes(data.role) || data.user.portal !== owner.portal)
    throw Error("The session verification context could not be validated.");
  return {
    id: data.user.id,
    portal: owner.portal,
    role: data.role,
    nextStep: typeof data.nextStep === "string" ? data.nextStep : "",
    name: typeof data.user.name === "string" ? data.user.name : "Your account",
    ...(typeof data.user.firebaseUid==='string'?{firebaseUid:data.user.firebaseUid}:{}),
  };
}
const publicRenewals = new Map<string, Promise<void>>();
async function renewPublicSession(pathname: string, expectedSnapshot: string, expectedGeneration: number): Promise<void> {
  if (expectedGeneration !== authVersion) throw Error("Account changed.");
  const owner = sessionCandidate(pathname);
  if (!owner || !owner.token.startsWith("aspctx.")) throw Error("Please sign in again.");
  if (owner.snapshot !== expectedSnapshot) return; // another fenced renewal completed
  const existing = publicRenewals.get(owner.snapshot);
  if (existing) return existing;
  const generation = authVersion;
  const current = () => {
    if (generation !== authVersion || sessionCandidate(pathname)?.snapshot !== owner.snapshot)
      throw Error("Account changed. Please sign in again.");
  };
  const operation = (async () => {
    const deadline = AbortSignal.timeout(15000);
    const bounded = async <T,>(work: Promise<T>): Promise<T> => {
      if (deadline.aborted) throw Error("Session renewal timed out. Retry sign-in.");
      let onAbort: () => void = () => {};
      try {
        return await Promise.race([work, new Promise<never>((_, reject) => {
          onAbort = () => reject(Error("Session renewal timed out. Retry sign-in."));
          deadline.addEventListener("abort", onAbort, { once: true });
        })]);
      } finally { deadline.removeEventListener("abort", onAbort); }
    };
    const { firebaseAuth } = await bounded(import("@/lib/firebaseClient"));
    await bounded(firebaseAuth.authStateReady());
    current();
    const descriptor = JSON.parse(localStorage.getItem("asp_user") || "{}");
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser || !descriptor.firebaseUid || descriptor.firebaseUid !== firebaseUser.uid)
      throw Error("The signed-in account changed. Select your account again.");
    const idToken = await bounded(firebaseUser.getIdToken(true));
    current();
    if (firebaseAuth.currentUser?.uid !== descriptor.firebaseUid) throw Error("Account changed.");
    const response = await fetch(publicAuthBase() + "/auth/context/refresh", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, portal: owner.portal }),
      credentials: "omit", cache: "no-store", signal: deadline,
    });
    const result: SessionResult = await bounded(response.json());
    current();
    if (firebaseAuth.currentUser?.uid !== descriptor.firebaseUid || !response.ok ||
      result.user?.id !== descriptor.id || result.user?.firebaseUid !== descriptor.firebaseUid)
      throw Error("Secure session renewal was not authorized. Sign in again.");
    // Avoid emitting an event that aborts the navigation verification which
    // initiated this renewal. Other consumers observe the changed snapshot.
    commitPortalSession(result, owner.portal, false);
  })().finally(() => publicRenewals.delete(owner.snapshot));
  publicRenewals.set(owner.snapshot, operation);
  return operation;
}
export function clearPublicPortal(portal: Portal) {
  let selected=true;try{const active=JSON.parse(localStorage.getItem("asp_user")||"{}").portal;selected=!active||active===portal;}catch{}
  if(selected)authVersion++;
  const prefix = portal === "customer" ? "asp_customer" : "asp_astrologer";
  for (const suffix of ["_access_token", "_refresh_token", "_user", "_expires_at"])
    localStorage.removeItem(prefix + suffix);
  if (portal === "customer") {
    localStorage.removeItem("asp_access_token");
    localStorage.removeItem("asp_refresh_token");
  }
  try {
    if (JSON.parse(localStorage.getItem("asp_user") || "{}").portal === portal)
      localStorage.removeItem("asp_user");
  } catch {
    localStorage.removeItem("asp_user");
  }
  if(selected)for (const key of [...privateKeys, "asp_otp_context", "asp_signup_data", "asp_google_redirect"]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  if(selected){document.cookie = "asp_user=; path=/; max-age=0; SameSite=Lax";
  window.dispatchEvent(new Event("asp-auth-changed"));}
}
export function signupErrors(values: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) {
  const errors: Record<string, string> = {};
  if (
    values.fullName.trim().length < 2 ||
    values.fullName.trim().length > 100 ||
    !/^[\p{L}\p{M}\s.'’\-]+$/u.test(values.fullName)
  )
    errors.fullName = "Enter your name (2–100 characters).";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ||
    values.email.length > 254
  )
    errors.email = "Enter a valid email address.";
  if (values.phone && !/^\+[1-9]\d{9,14}$/.test(values.phone))
    errors.phone =
      "Use an international phone number, for example +919876543210.";
  if (
    values.password.length < 8 ||
    values.password.length > 72 ||
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/[0-9]/.test(values.password) ||
    !/[^a-zA-Z0-9]/.test(values.password)
  )
    errors.password =
      "Use 8–72 characters with uppercase, lowercase, a number and a symbol.";
  return errors;
}
