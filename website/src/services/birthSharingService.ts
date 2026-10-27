export type BirthSharing = {
  state: string; isCustomer: boolean; details: Record<string, string | null> | null;
  profiles?: { profileRef: string; label: string }[]; profileRef?: string;
  birthVersion?: string; policyVersion?: string; revision?: number;
  astrologerName?: string; expiresAt?: string;
  canRevoke?: boolean;
};

export async function requestBirthSharing(input: {
  base: string; consultationId: string; action?: string; profileRef?: string;
  reviewed?: BirthSharing | null; signal: AbortSignal; readToken: () => string | null;
}): Promise<BirthSharing> {
  const token = input.readToken();
  const action = input.action ?? "";
  if (!token || !input.base || !input.consultationId || !["", "grant", "revoke"].includes(action)) throw Error("BIRTH_SHARING_UNAVAILABLE");
  const url = new URL(`${input.base.replace(/\/+$/, "")}/consultations/${encodeURIComponent(input.consultationId)}/birth-sharing${action ? `/${action}` : ""}`);
  if (!action && input.profileRef) url.searchParams.set("profileRef", input.profileRef);
  try {
    const response = await fetch(url, {
      method: action ? "POST" : "GET", cache: "no-store", signal: input.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: action === "grant" ? JSON.stringify({ profileRef: input.reviewed?.profileRef,
        birthVersion: input.reviewed?.birthVersion, policyVersion: input.reviewed?.policyVersion, revision: input.reviewed?.revision }) : undefined,
    });
    if (!response.ok) throw Error();
    const result = await response.json();
    if (input.signal.aborted || input.readToken() !== token || !result || typeof result.state !== "string" || typeof result.isCustomer !== "boolean") throw Error();
    return result as BirthSharing;
  } catch { throw Error("BIRTH_SHARING_UNAVAILABLE"); }
}
