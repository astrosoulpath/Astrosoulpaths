"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { loadStoredRemedies, remediesSession, type StoredRemedy } from "./customer-remedies";
import s from "./remedies.module.css";

function subscribe(notify: () => void) {
  const events = ["storage", "asp-auth-changed", "focus", "pageshow"];
  events.forEach(event => window.addEventListener(event, notify));
  document.addEventListener("visibilitychange", notify);
  // Also catch legacy same-tab session changes that omit the shared auth event.
  const timer = window.setInterval(notify, 1000);
  return () => { events.forEach(event => window.removeEventListener(event, notify)); document.removeEventListener("visibilitychange", notify); clearInterval(timer); };
}
function PrivateReports({ owner }: { owner: string }) {
  const [state, setState] = useState<{ busy: boolean; reports: StoredRemedy[] | null; error: string }>({ busy: false, reports: null, error: "" });
  const work = useRef<AbortController | null>(null);
  useEffect(() => () => { work.current?.abort(); }, []);
  async function load() {
    if (work.current || remediesSession() !== owner) return;
    const controller = new AbortController(); work.current = controller;
    setState({ busy: true, reports: null, error: "" });
    try {
      const reports = await loadStoredRemedies(owner, controller.signal);
      if (!controller.signal.aborted && remediesSession() === owner) setState({ busy: false, reports, error: "" });
    } catch (error) {
      if (!controller.signal.aborted && remediesSession() === owner) setState({ busy: false, reports: null, error: error instanceof Error ? error.message : "Report remedies could not be loaded." });
    } finally { if (work.current === controller) work.current = null; }
  }
  const current = remediesSession() === owner;
  return <div className={s.state}>
    <p>Load remedy text from your existing finalized astrologer reports. This is a read-only request, not a new reading or AI generation. No new subscription or purchase is required to view reports already authorized to your account.</p>
    <button type="button" className={s.loadButton} onClick={load} disabled={state.busy || !current}>{state.busy ? "Loading your reports…" : state.error ? "Retry my report remedies" : "Load my report remedies"}</button>
    {current && state.error && <p role="alert">{state.error}</p>}
    {current && state.reports?.length === 0 && <p role="status">No finalized reports with remedy text are available for your account. No personalized result has been substituted.</p>}
    {current && state.reports && state.reports.length > 0 && <div aria-live="polite"><p>Previously finalized report guidance, shown as recorded. It may not reflect your current circumstances. Up to 50 reports containing guidance are shown.</p>{state.reports.map((report, index) => <article key={report.id}><h3>Report guidance {index + 1}</h3><p className={s.reportText}>{report.remedies}</p></article>)}<button type="button" className={s.loadButton} onClick={() => setState({ busy: false, reports: null, error: "" })}>Hide report guidance</button></div>}
  </div>;
}
export default function CustomerRemedies() {
  const owner = useSyncExternalStore(subscribe, remediesSession, () => "");
  return <section className={s.section} aria-labelledby="stored-remedies-title"><h2 id="stored-remedies-title">Remedies from your existing reports</h2><p>Only guidance already finalized for your account is shown. Viewing it does not authorize new access to birth data or start a consultation.</p>{owner ? <PrivateReports key={owner} owner={owner}/> : <div className={s.state}><p>Sign in with your Customer account to view authorized report guidance.</p><Link href="/login">Customer sign-in →</Link></div>}</section>;
}
