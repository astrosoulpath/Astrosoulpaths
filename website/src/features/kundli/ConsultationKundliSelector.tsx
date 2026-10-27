"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { consultationKundliSession } from "./consultation-kundli-api";
import { loadKundliConsultations, type ConsultationSelection } from "./consultation-selector-api";
import s from "./kundli-premium.module.css";
function subscribe(notify: () => void) {
  const events = ["asp-auth-changed", "storage", "focus", "pageshow"];
  events.forEach(event => window.addEventListener(event, notify));
  const timer = setInterval(notify, 1000);
  return () => { events.forEach(event => window.removeEventListener(event, notify)); clearInterval(timer); };
}
function Selection({ owner }: { owner: string }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "ACTIVE", page: 1 });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ConsultationSelection | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setResult(null); setError("");
    void loadKundliConsultations(owner, filters, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Consultations could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [owner, filters, attempt]);
  return <>
    <form className={s.grid} onSubmit={event => { event.preventDefault(); setFilters(value => ({ ...value, search, page: 1 })); }}>
      <div><label htmlFor="kundli-consultation-search">Search your consultations</label><input id="kundli-consultation-search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Search by participant name" /></div>
      <div><label htmlFor="kundli-consultation-status">Consultation status</label><select id="kundli-consultation-status" value={filters.status} onChange={event => setFilters(value => ({ ...value, status: event.target.value, page: 1 }))}><option value="">All statuses</option>{["ACTIVE", "PENDING", "COMPLETED", "ENDED", "CANCELLED", "REJECTED", "EXPIRED"].map(value => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select></div>
      <button type="submit" disabled={busy}>Search consultations</button>
    </form>
    {busy && <p role="status">Loading your consultations…</p>}
    {error && <div role="alert"><p className={s.error}>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry consultations</button></div>}
    {!busy && result?.items.length === 0 && <p role="status">No consultations match these filters. An existing active consultation is required for new generation; no paid session will be started here.</p>}
    {result && <><div className={s.grid}>{result.items.map(item => <article key={item.id} className={s.report}><h2>{item.name}</h2><p>{item.mode} · {item.status}</p>{Number.isFinite(Date.parse(item.createdAt)) && <p>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</p>}<Link href={`/kundli/consultations/${encodeURIComponent(item.id)}`}>Open consultation Kundli</Link><p>Consent and professional eligibility are checked securely when you open this consultation.</p></article>)}</div>
      <nav className={s.actions} aria-label="Consultation pages"><button type="button" disabled={busy || filters.page <= 1} onClick={() => setFilters(value => ({ ...value, page: value.page - 1 }))}>Previous</button><span role="status">Page {filters.page} of {Math.max(1, result.totalPages)}</span><button type="button" disabled={busy || filters.page >= result.totalPages} onClick={() => setFilters(value => ({ ...value, page: value.page + 1 }))}>Next</button></nav></>}
  </>;
}
export default function ConsultationKundliSelector() {
  const owner = useSyncExternalStore(subscribe, consultationKundliSession, () => "");
  return <main className={s.page}><div className={s.wrap}><header className={s.hero}><div><p className={s.eyebrow}>YOUR CONSULTATIONS</p><h1>Choose your Kundli consultation</h1><p>Open an existing consultation to review consent or generate an authorized professional chart. This page never starts or charges for a consultation.</p></div></header><section className={s.panel}>
    {owner ? <Selection key={owner} owner={owner} /> : <><p>Sign in to see only your own consultations.</p><nav className={s.actions}><Link href="/login?redirect=/kundli/consultations">Customer sign-in</Link><Link href="/astrologer/login">Astrologer sign-in</Link></nav></>}
  </section><Link href="/kundli">Back to Kundli</Link></div></main>;
}
