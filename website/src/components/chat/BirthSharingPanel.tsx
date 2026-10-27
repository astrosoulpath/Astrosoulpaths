"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestBirthSharing, type BirthSharing as Sharing } from "@/services/birthSharingService";
export function birthSharingToken() {
  try {
    return localStorage.getItem("asp_astrologer_access_token") ??
      localStorage.getItem("asp_access_token") ?? localStorage.getItem("access_token");
  } catch { return null; }
}

/** Dedicated transient view. Never persists details or sends them as messages. */
export default function BirthSharingPanel({ consultationId }: { consultationId: string }) {
  const [data, setData] = useState<Sharing | null>(null);
  const [selected, setSelected] = useState("");
  const selection = useRef("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const owner = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const current = useRef<Sharing | null>(null);
  const clear = useCallback(() => {
    epoch.current++; controller.current?.abort(); current.current = null;
    setData(null); setBusy(false);
  }, []);
  const load = useCallback(async (action = "", profileRef = "", reviewed?: Sharing | null) => {
    clear(); setError("");
    if (document.visibilityState !== "visible") return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
    const token = birthSharingToken();
    if (!base || !token || (owner.current && owner.current !== token)) {
      setError("Session changed. Reopen the consultation."); return;
    }
    owner.current = token;
    const requestEpoch = epoch.current;
    const abort = new AbortController(); controller.current = abort; setBusy(true);
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const result = await requestBirthSharing({base, consultationId, action, profileRef, reviewed, signal: abort.signal, readToken: birthSharingToken});
      if (epoch.current !== requestEpoch || birthSharingToken() !== token || document.visibilityState !== "visible") return;
      current.current = result; setData(result);
    } catch {
      if (epoch.current === requestEpoch) setError("Birth details unavailable. Refresh to verify permission.");
    } finally {
      clearTimeout(timeout);
      if (epoch.current === requestEpoch) setBusy(false);
    }
  }, [clear, consultationId]);
  useEffect(() => {
    owner.current = null; selection.current = ""; setSelected(""); void load();
    const changed = () => { clear(); if (document.visibilityState === "visible") void load("", selection.current); };
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("storage", changed);
    const expiry = setInterval(() => {
      if (owner.current !== birthSharingToken() || (current.current?.expiresAt && Date.parse(current.current.expiresAt) <= Date.now())) clear();
    }, 1000);
    const refresh = setInterval(() => { void load("", selection.current); }, 30000);
    return () => {
      // This ref is a request generation, not a DOM node; cleanup must fence the latest request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++; controller.current?.abort(); current.current = null;
      clearInterval(expiry); clearInterval(refresh);
      document.removeEventListener("visibilitychange", changed); window.removeEventListener("storage", changed);
    };
  }, [clear, load]);
  return <section aria-label="Customer birth details" className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
    <h2 className="font-semibold">Customer birth details</h2>
    {busy && <p role="status">Verifying permission…</p>}
    {error && <p role="status">{error}</p>}
    {data?.isCustomer && <>
      <label className="block">Select and review a birth profile
        <select value={selected} disabled={busy} className="m-2 max-w-full rounded border p-2"
          onChange={e => { const value = e.target.value; selection.current = value; setSelected(value); void load("", value); }}>
          <option value="">Choose a profile</option>
          {data.profiles?.map(p => <option key={p.profileRef} value={p.profileRef}>{p.label}</option>)}
        </select>
      </label>
      <p>Confirm you are authorized to share this selected person&apos;s details with {data.astrologerName ?? "the assigned astrologer"} for this active consultation. You can revoke permission. It expires when the consultation ends and does not authorize Kundli generation.</p>
    </>}
    {data?.details && <dl>{Object.entries({ fullName: "Name", dateOfBirth: "Date of birth", timeOfBirth: "Birth time", birthPlace: "Birth place", gender: "Gender" }).map(([key, label]) =>
      data.details?.[key] && <div key={key}><dt className="font-medium">{label}</dt><dd>{data.details[key]}</dd></div>)}</dl>}
    {data && !data.details && <p>No birth details are shared. Ordinary consultation remains available.</p>}
    {data?.isCustomer && data.details && data.state !== "SHARED" && <button disabled={busy} onClick={() => void load("grant", selected, data)} className="m-2 rounded bg-slate-900 p-2 text-white">I agree — share these details</button>}
    {data?.isCustomer && <button disabled={busy} onClick={() => data.state === "SHARED" || data.canRevoke ? void load("revoke") : clear()} className="m-2 rounded border p-2">{data.state === "SHARED" || data.canRevoke ? "Revoke sharing" : "Not now"}</button>}
    <button disabled={busy} onClick={() => void load("", selected)} className="m-2 underline">Refresh permission</button>
  </section>;
}
