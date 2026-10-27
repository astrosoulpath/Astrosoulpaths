type Pending = { requestKey: string; lang: "en" | "hi"; createdAt: number };
function scope(owner: string, consultation: string) {
  const [, raw] = JSON.parse(owner) as string[];
  const account = JSON.parse(raw) as { id?: string; portal?: string };
  if (account.portal !== "astrologer" || typeof account.id !== "string" || !account.id || !/^[a-zA-Z0-9-]{1,120}$/.test(consultation))
    throw Error("A verified professional session and consultation are required.");
  return "asp_kundli_pending:" + JSON.stringify([account.id, account.portal, consultation]);
}
export function readPendingKundli(owner: string, consultation: string): Pending | null {
  try {
    const raw = sessionStorage.getItem(scope(owner, consultation));
    if (!raw) return null;
    const value = JSON.parse(raw) as Pending;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestKey) || !["en", "hi"].includes(value.lang) || !Number.isFinite(value.createdAt))
      return null;
    return value;
  } catch { return null; }
}
export function beginPendingKundli(owner: string, consultation: string, lang: "en" | "hi"): Pending {
  const key = scope(owner, consultation);
  // A malformed existing entry is uncertain, not permission to issue a fresh
  // request. Resolve saved reports rather than silently create a duplicate.
  const existing = sessionStorage.getItem(key);
  const pending = readPendingKundli(owner, consultation);
  if (existing && !pending) throw Error("The pending request could not be restored. Check your saved reports before starting another generation.");
  if (pending) return pending;
  const next = { requestKey: crypto.randomUUID(), lang, createdAt: Date.now() };
  sessionStorage.setItem(key, JSON.stringify(next));
  return next;
}
export function finishPendingKundli(owner: string, consultation: string) {
  sessionStorage.removeItem(scope(owner, consultation));
}
