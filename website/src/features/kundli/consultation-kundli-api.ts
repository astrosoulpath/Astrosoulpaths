import { supportBase } from "@/features/support/customer-support-api";

export type ConsultationKundliStatus = {
  consultationId: string;
  consultationStatus: string;
  state: string;
  canGenerate: boolean;
  canGrant: boolean;
  canRevoke: boolean;
  policyVersion: string;
  expiresAt: string;
};

// Never fall back to a credential belonging to a different portal.
export function consultationKundliSession(): string {
  try {
    const raw = localStorage.getItem("asp_user") || "";
    const portal = JSON.parse(raw).portal;
    if (portal !== "customer" && portal !== "astrologer") return "";
    const token = localStorage.getItem(`asp_${portal}_access_token`);
    return token ? JSON.stringify([token, raw]) : "";
  } catch { return ""; }
}

export async function consultationKundliRequest(
  owner: string, id: string, operation: "status" | "grant" | "revoke" | "generate",
  signal: AbortSignal, body?: { accepted: true; policyVersion: string } | { requestKey: string; lang: "en" | "hi" },
): Promise<{ success: true; data: ConsultationKundliStatus & { savedRecordId?: string } }> {
  const current = () => {
    if (!owner || signal.aborted || consultationKundliSession() !== owner)
      throw Error("Your account changed or expired. Reopen this consultation.");
  };
  current();
  if (!/^[a-zA-Z0-9-]{1,120}$/.test(id)) throw Error("Invalid consultation reference.");
  const response = await fetch(`${supportBase()}/kundli/v1/consultations/${encodeURIComponent(id)}/${operation === "generate" ? "generate" : "consent"}`, {
    method: operation === "status" ? "GET" : operation === "revoke" ? "DELETE" : "POST",
    headers: { Authorization: `Bearer ${JSON.parse(owner)[0]}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(65000)]),
  });
  const result = await response.json().catch(() => null);
  current();
  if (response.status === 404 || response.status === 503)
    throw Error("Consultation generation is unavailable on this server. No activation or successful report is assumed. Retry with the same request after the operator checks readiness.");
  if (response.status === 401) throw Error("Your session expired. Sign in again.");
  if (!response.ok || result?.success !== true || !result.data)
    throw Error(typeof result?.message === "string" ? result.message : "Authorization or generation was not confirmed. Refresh the consultation before retrying.");
  return result;
}
