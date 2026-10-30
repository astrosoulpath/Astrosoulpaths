import {
  publicAuthBase,
  sessionCandidate,
  verifyNavigationSession,
  destinationFor,
} from "@/features/auth/public-auth";
export type Row = Record<string, unknown>;
export const record = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export class ProfessionalAccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function professionalOwner() {
  const candidate = sessionCandidate("/astrologer/dashboard");
  let descriptor;
  try {
    descriptor = JSON.parse(localStorage.getItem("asp_user") || "{}");
  } catch {
    throw new ProfessionalAccessError(401, "Astrologer sign-in is required.");
  }
  if (
    !candidate ||
    candidate.portal !== "astrologer" ||
    descriptor.portal !== "astrologer" ||
    typeof descriptor.id !== "string"
  )
    throw new ProfessionalAccessError(
      401,
      "Use your authorized Astrologer account.",
    );
  return { ...candidate, id: descriptor.id };
}
export async function verifiedProfessional(signal: AbortSignal) {
  const verified = await verifyNavigationSession(
    "/astrologer/dashboard",
    signal,
  );
  if (!verified || verified.portal !== "astrologer")
    throw new ProfessionalAccessError(401, "Astrologer sign-in is required.");
  const target = destinationFor(verified, "astrologer");
  if (target !== "/astrologer/dashboard")
    return { redirect: target, id: verified.id };
  if (verified.role !== "ASTROLOGER" || professionalOwner().id !== verified.id)
    throw new ProfessionalAccessError(
      403,
      "Professional identity could not be verified.",
    );
  return { id: verified.id };
}
export async function professionalRequest(
  path: string,
  init: RequestInit = {},
) {
  const method = init.method ?? "GET",
    read = [
      "/astrologer/dashboard",
      "/astrologer/profile",
      "/astrologer/availability",
      "/astrologer/earnings/summary",
      "/consultations/astrologer/current",
      "/consultations/astrologer/history?page=1&limit=10",
      "/notifications",
    ];
  const write =
    [
      "/astrologer/status",
      "/astrologer/profile",
      "/astrologer/availability",
    ].includes(path) ||
    /^\/consultations\/[A-Za-z0-9_-]{1,128}\/(accept|reject)$/.test(path);
  if (!(method === "GET" ? read.includes(path) : method === "PATCH" && write))
    throw Error("Unsupported professional operation.");
  const before = professionalOwner(),
    headers = new Headers({
      Accept: "application/json",
      Authorization: "Bearer " + before.token,
    });
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(publicAuthBase() + path, {
    ...init,
    headers,
    method,
    credentials: "omit",
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  const body = record(await response.json().catch(() => null));
  if (professionalOwner().snapshot !== before.snapshot)
    throw Error("Account changed. Reload your professional workspace.");
  if (response.status === 401 || response.status === 403)
    throw new ProfessionalAccessError(
      response.status,
      "Professional access must be verified again.",
    );
  if (!response.ok || body.success !== true)
    throw Error(
      method === "GET"
        ? "Professional records could not be loaded."
        : "Change not confirmed. Reload server records before another attempt.",
    );
  if(method!=='GET'&&typeof window!=='undefined')window.dispatchEvent(new Event('asp-communication-changed'));
  return body;
}
export function ownedRequests(value: unknown, userId: string) {
  if (
    !Array.isArray(value) ||
    value.some(
      (v) =>
        typeof record(v).id !== "string" || record(v).astrologerId !== userId,
    )
  )
    throw Error("Consultation ownership could not be verified.");
  return value as Row[];
}
export function consultationDestination(call: Row) {
  if (typeof call.id !== "string") return null;
  const id = encodeURIComponent(call.id),
    mode = String(call.mode ?? "").toLowerCase();
  return mode === "chat"
    ? "/chat/" + id
    : mode === "audio"
      ? "/chat/" + id + "?mode=audio"
      : null;
}
export type AvailabilityDay = {
  dayOfWeek: number;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
};
export function availabilityPayload(timezone: string, days: AvailabilityDay[]) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
  } catch {
    throw Error("Choose a valid IANA timezone.");
  }
  if (
    !timezone ||
    !days.length ||
    new Set(days.map((d) => d.dayOfWeek)).size !== days.length ||
    days.some(
      (d) =>
        !Number.isInteger(d.dayOfWeek) ||
        d.dayOfWeek < 0 ||
        d.dayOfWeek > 6 ||
        typeof d.isEnabled !== "boolean" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.endTime) ||
        d.startTime >= d.endTime,
    )
  )
    throw Error(
      "Use unique weekdays and valid start/end times within the same day.",
    );
  return {
    timezone,
    days: days.map(({ dayOfWeek, isEnabled, startTime, endTime }) => ({
      dayOfWeek,
      isEnabled,
      startTime,
      endTime,
    })),
  };
}
export function profilePayload(bio: string, price: string) {
  if (
    bio.length > 4000 ||
    !/^\d+(?:\.\d{1,2})?$/.test(price) ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 1 ||
    Number(price) > Number.MAX_SAFE_INTEGER
  )
    throw Error(
      "Enter a supported description and rate of at least 1, with up to two decimal places.",
    );
  return { bio: bio.trim(), pricePerMin: Number(price) };
}
