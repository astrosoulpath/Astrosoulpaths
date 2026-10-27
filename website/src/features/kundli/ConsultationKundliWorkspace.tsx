"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { consultationKundliRequest, consultationKundliSession, type ConsultationKundliStatus } from "./consultation-kundli-api";
import s from "./kundli-premium.module.css";
import { beginPendingKundli, finishPendingKundli, readPendingKundli } from "./pending-kundli-request";

function subscribe(notify: () => void) {
  const events = ["asp-auth-changed", "storage", "focus", "pageshow"];
  events.forEach(event => window.addEventListener(event, notify));
  const timer = setInterval(notify, 1000);
  return () => { events.forEach(event => window.removeEventListener(event, notify)); clearInterval(timer); };
}
export default function ConsultationKundliWorkspace({ id }: { id: string }) {
  const owner = useSyncExternalStore(subscribe, consultationKundliSession, () => "");
  return <Workspace key={owner + id} id={id} owner={owner} />;
}
function Workspace({ id, owner }: { id: string; owner: string }) {
  const [status, setStatus] = useState<ConsultationKundliStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [language, setLanguage] = useState<"en" | "hi">(() => readPendingKundli(owner, id)?.lang || "en");
  const [saved, setSaved] = useState("");
  const [uncertainRequest, setUncertainRequest] = useState(() => !!readPendingKundli(owner, id));
  const pending = useRef(false), requestKey = useRef(""), work = useRef<AbortController | null>(null);
  useEffect(() => () => { work.current?.abort(); }, []);
  async function run(operation: "status" | "grant" | "revoke" | "generate") {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    const controller = new AbortController(); work.current = controller;
    try {
      if (operation === "generate" && !requestKey.current) { const restored = beginPendingKundli(owner, id, language); requestKey.current = restored.requestKey; setUncertainRequest(true); }
      const body = operation === "generate" ? { requestKey: requestKey.current, lang: language } : operation === "grant" ? { accepted: true as const, policyVersion: status?.policyVersion || "" } : undefined;
      const result = await consultationKundliRequest(owner, id, operation, controller.signal, body);
      if (operation === "generate") {
        const record = result.data.savedRecordId;
        if (!record || !/^[a-zA-Z0-9-]{1,120}$/.test(record)) throw Error("No valid saved report was confirmed. Retry with the same request.");
        setSaved(record); finishPendingKundli(owner, id); requestKey.current = ""; setUncertainRequest(false);
      }
      const refreshed = operation === "status" ? result : await consultationKundliRequest(owner, id, "status", controller.signal);
      setStatus(refreshed.data);
      if (operation === "revoke") setAccepted(false);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The operation was not confirmed. Refresh and retry.");
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <main className={s.page}><div className={s.wrap}>
    <header className={s.hero}><div><p className={s.eyebrow}>CONSULTATION-BOUND PROFESSIONAL KUNDLI</p><h1>Your authorized consultation chart</h1><p>Generation uses the customer&apos;s existing primary birth profile, the existing local engine and server-verified consent. No birth details from the public preparation form are submitted here.</p></div></header>
    <section className={s.panel}><h2>Check authorization</h2>
      {!owner && <p>Sign in through the existing Customer or Astrologer login, then reopen this consultation.</p>}
      <button disabled={busy || !owner} onClick={() => void run("status")}>{busy ? "Checking or processing…" : "Refresh consultation authorization"}</button>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {uncertainRequest && <p role="status">An unfinished request is retained for this account and consultation. Retry reuses its request reference and language, including after refresh. Check saved reports if authorization has ended.</p>}
      {status && <><p role="status">Consultation: {status.consultationStatus}. Consent: {status.state}.</p>
        <p>Consent is limited to this customer, astrologer, consultation and local Kundli calculation. It covers birth date, birth time, coordinates, timezone and birthplace in the existing primary profile. You can revoke at any time. It expires when this consultation ends; existing reports retain their ownership rules. Grants and revocations are durably audited.</p>
        {status.canGrant && <><label><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /> I explicitly authorize this use of my birth profile for this consultation.</label><button disabled={busy || !accepted} onClick={() => void run("grant")}>Grant consultation consent</button></>}
        {status.canRevoke && <button disabled={busy} onClick={() => void run("revoke")}>Revoke consent</button>}
        {status.canGenerate && <><label htmlFor="consultation-kundli-language">Generation language</label><select id="consultation-kundli-language" value={language} disabled={busy || uncertainRequest} onChange={event => setLanguage(event.target.value as "en" | "hi")}><option value="en">English</option><option value="hi">Hindi</option></select><p>Professional access requires an approved astrologer and ACTIVE INR 3,500 / 365-day entitlement. No subscription generation quota; security rate limits apply. No outcome is guaranteed.</p><button disabled={busy} onClick={() => void run("generate")}>{busy ? "Calculating…" : "Generate consultation Kundli"}</button></>}
        {!status.canGenerate && <p>New generation is not authorized for this session. The server enforces active consultation, approved professional entitlement, valid primary birth details and current consent.</p>}
      </>}
      {saved && <p role="status">Your report was saved. <Link href={`/astrologer/kundli/saved/${encodeURIComponent(saved)}`}>Open calculated chart and authorized PDF</Link></p>}
    </section><Link href="/kundli">Back to Kundli preparation</Link>
  </div></main>;
}
