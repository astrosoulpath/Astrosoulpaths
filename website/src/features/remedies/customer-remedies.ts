import { supportSession, supportBase } from "@/features/support/customer-support-api";

export type StoredRemedy = { id: string; remedies: string };
export function remediesSession(): string {
  try { return supportSession(); } catch { return ""; }
}
export function projectRemedies(value: unknown): StoredRemedy[] {
  const body = value as { success?: boolean; data?: unknown } | null;
  if (body?.success !== true || !Array.isArray(body.data)) throw Error("Report response was invalid. Please retry.");
  return body.data.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter(item => item.status === "FINAL" && typeof item.id === "string" && typeof item.remedies === "string" && item.remedies.trim())
    .slice(0, 50).map(item => ({ id: item.id as string, remedies: item.remedies as string }));
}
export async function loadStoredRemedies(owner: string, signal: AbortSignal): Promise<StoredRemedy[]> {
  if (!owner || remediesSession() !== owner) throw Error("Sign in with your Customer account.");
  const token = (JSON.parse(owner) as string[])[0];
  const response = await fetch(supportBase() + "/kundli/manual-reports/customer/final", {
    method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store", credentials: "omit", signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (signal.aborted || remediesSession() !== owner) throw Error("Your account changed. Load your reports again.");
  if (response.status === 401 || response.status === 403) throw Error("Your Customer session is unavailable or unauthorized. Sign in again.");
  if (!response.ok) throw Error("Report remedies could not be loaded. Please retry.");
  const body: unknown = await response.json();
  if (signal.aborted || remediesSession() !== owner) throw Error("Your account changed. Load your reports again.");
  return projectRemedies(body);
}
