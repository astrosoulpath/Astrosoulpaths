import { supportBase } from "@/features/support/customer-support-api";
import { consultationKundliSession } from "./consultation-kundli-api";

export type KundliConsultation = { id: string; name: string; status: string; mode: string; createdAt: string };
export type ConsultationSelection = { items: KundliConsultation[]; page: number; totalPages: number };
export async function loadKundliConsultations(owner: string, filters: { search: string; status: string; page: number }, signal: AbortSignal): Promise<ConsultationSelection> {
  const current = () => {
    if (!owner || signal.aborted || consultationKundliSession() !== owner) throw Error("Your account changed. Reopen your consultations.");
  };
  current();
  const [token, raw] = JSON.parse(owner) as string[];
  const account = JSON.parse(raw) as { id: string; portal: string };
  if (!account.id || !["customer", "astrologer"].includes(account.portal)) throw Error("Sign in with your Customer or Astrologer account.");
  if (filters.search.length > 100 || !Number.isSafeInteger(filters.page) || filters.page < 1 ||
      !["", "ACTIVE", "PENDING", "COMPLETED", "ENDED", "CANCELLED", "REJECTED", "EXPIRED"].includes(filters.status)) throw Error("Choose valid consultation filters.");
  const query = new URLSearchParams({ page: String(filters.page), limit: "12" });
  if (filters.search.trim()) query.set("search", filters.search.trim());
  if (filters.status) query.set("status", filters.status);
  const route = account.portal === "astrologer" ? "/consultations/astrologer/history" : "/consultations/history";
  const response = await fetch(supportBase() + route + "?" + query, {
    headers: { Authorization: `Bearer ${token}` }, credentials: "omit", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  const body = await response.json().catch(() => null);
  current();
  if (response.status === 401) throw Error("Your session needs renewal. Use Retry account verification in the header, or sign in again.");
  if (response.status === 403) throw Error("This account is not authorized to view these consultations.");
  if (!response.ok || body?.success !== true || !Array.isArray(body.data) ||
      !Number.isSafeInteger(body.pagination?.totalPages) || body.pagination.totalPages < 0)
    throw Error("Consultations could not be loaded. Please retry.");
  const items: KundliConsultation[] = [];
  const seen = new Set<string>();
  for (const row of body.data) {
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9-]{1,120}$/.test(row.id) || seen.has(row.id)) continue;
    if ((account.portal === "customer" && row.userId !== account.id) ||
      (account.portal === "astrologer" && row.astrologerId !== undefined && row.astrologerId !== account.id))
      throw Error("The consultation response did not match this account. No records will be displayed.");
    seen.add(row.id);
    const participant = account.portal === "customer" ? row.astrologer : row.user;
    const label = participant?.userProfile?.fullName || participant?.name;
    items.push({ id: row.id, name: typeof label === "string" ? label : account.portal === "customer" ? "Assigned astrologer" : "Consultation customer", status: typeof row.status === "string" ? row.status : "Unknown", mode: typeof row.mode === "string" ? row.mode : "Consultation", createdAt: typeof row.createdAt === "string" ? row.createdAt : "" });
  }
  return { items, page: filters.page, totalPages: body.pagination.totalPages };
}
