"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { customerSession, generalPath, HoroscopeError, horoscopeRequest, isDailyOffer, LOCALES, object, PERIODS, planLabel, SIGNS, strings, text, type JsonRecord, type Period } from './horoscope-api';
import styles from './horoscope.module.css';
import { HoroscopeCheckout } from './HoroscopeCheckout';

function sessionFingerprint() { try { return customerSession(); } catch { return ''; } }

/** No persisted private cache; abort on navigation and clear on account changes. */
export function useHoroscopeResource(path: string | null, isPrivate = false) {
  const [result, setResult] = useState<{body: JsonRecord; owner: string; path: string} | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [account, setAccount] = useState('');
  const generation = useRef(0);
  const expiry = useRef(0);
  useEffect(() => {
    if (!isPrivate) return;
    let previous = sessionFingerprint();
    const invalidate = () => {
      if (expiry.current && expiry.current <= Date.now()) {
        expiry.current = 0; generation.current++; setResult(null); setBusy(false); setError('Your reading entitlement expired. Check your subscription before reloading.');
      }
      const next = sessionFingerprint();
      if (next === previous) return;
      previous = next;
      generation.current++;
      setResult(null); setError(''); setBusy(false); setAccount(next);
    };
    const timer = window.setInterval(invalidate, 1000);
    window.addEventListener('storage', invalidate);
    window.addEventListener('asp-auth-changed', invalidate);
    window.addEventListener('focus', invalidate);
    return () => { clearInterval(timer); window.removeEventListener('storage', invalidate); window.removeEventListener('asp-auth-changed', invalidate); window.removeEventListener('focus', invalidate); };
  }, [isPrivate]);
  useEffect(() => {
    const fence = generation;
    const run = ++fence.current;
    const controller = new AbortController();
    setResult(null); setError(''); setBusy(false);
    expiry.current = 0;
    if (!path) return () => { fence.current++; };
    const owner = isPrivate ? sessionFingerprint() : '';
    if (isPrivate && !owner) { setError('Sign in to the Customer website to continue.'); return; }
    setBusy(true);
    void horoscopeRequest(path, isPrivate, {signal: controller.signal}).then(body => {
      if (generation.current === run) {
        if (isPrivate && path.split('?')[0] === '/dailyinsight') expiry.current = Date.parse(text(object(body.entitlement).endDate));
        setResult({body, owner, path});
      }
    }).catch(error => {
      if (generation.current === run && !controller.signal.aborted) {
        setError(error instanceof HoroscopeError ? error.message : 'Could not load Horoscope. Check your connection and retry.');
      }
    }).finally(() => { if (generation.current === run) setBusy(false); });
    return () => { fence.current++; controller.abort(); };
  }, [path, isPrivate, attempt, account]);
  const data = result && result.path === path && (!isPrivate || (typeof window !== 'undefined' && result.owner === sessionFingerprint())) ? result.body : null;
  return {data, error, busy, reload: () => setAttempt(value => value + 1)};
}

export function HoroscopeShell({title, description, children}: {title: string; description: string; children: React.ReactNode}) {
  return <main className={styles.page}><div className={styles.wrap}>
    <nav className={styles.nav} aria-label="Horoscope navigation"><Link href="/horoscope">Horoscope home</Link><Link href="/horoscope/free">Free Rashi readings</Link><Link href="/horoscope/personalized">Personalized daily</Link><Link href="/horoscope/subscription">Subscription & reminders</Link></nav>
    <header className={styles.hero}><span className={styles.orbit} aria-hidden="true"/><span className={styles.eyebrow}>Astro Soul Path · Vedic guidance</span><h1>{title}</h1><p>{description}</p></header>
    {children}<p className={styles.fine}>Astrology offers reflective guidance, not guaranteed outcomes or medical, relationship or investment advice.</p>
  </div></main>;
}

export function ZodiacGrid() {
  return <div className={styles.signs}>{SIGNS.map(([slug, name, symbol]) => <Link className={styles.sign} key={slug} href={`/horoscope/${slug}`}><span className={styles.symbol} aria-hidden="true">{symbol}</span>{name}</Link>)}</div>;
}

function LoadingError({resource}: {resource: ReturnType<typeof useHoroscopeResource>}) {
  return <>{resource.busy && <div role="status" aria-label="Loading Horoscope" className={styles.skeleton}/>}{resource.error && <div role="alert" className={styles.notice}><p>{resource.error}</p><button className={styles.button} onClick={resource.reload}>Retry</button> <Link href="/login">Customer sign in</Link></div>}</>;
}

function SelectLanguage({value, onChange}: {value: string; onChange: (value: string) => void}) {
  return <label>Reading language<select value={value} onChange={event => onChange(event.target.value)}>{LOCALES.map(locale => <option key={locale} value={locale}>{new Intl.DisplayNames(['en'], {type: 'language'}).of(locale)}</option>)}</select></label>;
}

function TextCard({title, value}: {title: string; value: unknown}) {
  const content = text(value);
  return content ? <article className={styles.card}><h2>{title}</h2><p>{content}</p></article> : null;
}

export function FreeHoroscope({initialSign = 'aries'}: {initialSign?: string}) {
  const [sign, setSign] = useState(initialSign);
  const [period, setPeriod] = useState<Period>('today');
  const [locale, setLocale] = useState('en');
  // User starts generation explicitly; rendering/SEO/build never invokes a paid provider.
  const [request, setRequest] = useState<string | null>(null);
  const resource = useHoroscopeResource(request);
  const data = resource.data;
  const interpretation = object(data?.interpretation);
  const evidence = Array.isArray(data?.moonSignTransit) ? data.moonSignTransit : [];
  const ratings = object(object(data?.todayRating).ratings), scale = object(data?.todayRating).scale;
  return <>
    <form className={styles.controls} onSubmit={event => {event.preventDefault(); setRequest(generalPath(sign, period, locale)); resource.reload();}}>
      <label>Moon sign / Rashi<select value={sign} onChange={event => {setSign(event.target.value); setRequest(null);}}>{SIGNS.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
      <label>Period<select value={period} onChange={event => {setPeriod(event.target.value as Period); setRequest(null);}}>{PERIODS.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      <SelectLanguage value={locale} onChange={value => {setLocale(value); setRequest(null);}}/>
      <button className={styles.button} disabled={resource.busy}>View free reading</button>
    </form>
    <p className={styles.fine}>Choose your Vedic Moon sign, not necessarily your Western Sun sign. Daily, weekly, monthly and yearly readings come from the shared backend. No birth profile or subscription is required for these general readings.</p>
    <LoadingError resource={resource}/>
    {!request && <p className={styles.notice}>Choose a Rashi and period, then request your reading.</p>}
    {data && <section lang={text(data.language) || locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-label="General Horoscope result">
      <p className={styles.fine}>{text(object(data.moonSign).name)} · {text(data.date) || `${text(data.startDate)} – ${text(data.endDate)}`}</p>
      <div className={styles.grid}><TextCard title="Your reading" value={interpretation.summary}/><TextCard title="Advice" value={interpretation.advice}/></div>
      {typeof scale === 'number' && scale > 0 && <div className={styles.grid} aria-label="Backend transit indices">{[['loveMatters', 'Love'], ['occupation', 'Career'], ['wealth', 'Finance'], ['health', 'Health']].map(([key, label]) => typeof ratings[key] === 'number' && Number.isFinite(ratings[key]) && Number(ratings[key]) >= 0 && Number(ratings[key]) <= scale ? <TextCard key={key} title={label} value={`${ratings[key]} / ${scale} · Engine interpretation index, not a probability or guaranteed outcome.`}/> : null)}</div>}
      {!text(interpretation.summary) && <p role="status">No interpretation was returned. No prediction has been substituted.</p>}
      {evidence.length > 0 && <details className={styles.card}><summary>Planetary context from the calculation engine</summary><ul>{evidence.map((entry, index) => {const planet = object(entry); return <li key={index}>{text(planet.name)} · {text(planet.sign)} · {text(planet.nakshatra)}{planet.retrograde === true ? ' · Retrograde' : ''}</li>;})}</ul></details>}
      <p className={styles.fine}>Separate Love, Career, Finance, Health and lucky details appear only when supplied by the supported response; none are inferred from ratings.</p>
    </section>}
  </>;
}

export function PersonalizedHoroscope() {
  const [day, setDay] = useState('today'), [locale, setLocale] = useState('en');
  const [request, setRequest] = useState<{path: string; owner: string} | null>(null);
  const requestPath = request && typeof window !== 'undefined' && request.owner === sessionFingerprint() ? request.path : null;
  const resource = useHoroscopeResource(requestPath, true);
  const data = object(resource.data?.data), ai = object(data.ai), highlights = object(data.dailyHighlights), guidance = object(data.guidance);
  const lucky = object(data.lucky);
  const generation = object(data.generation), vedic = object(data.vedic);
  const lifeAreas = Array.isArray(data.lifeAreas) ? data.lifeAreas : [];
  return <>
    <div className={styles.notice}>Requires a server-verified active Daily Horoscope subscription and a complete saved birth profile. No birth details are copied into URLs or browser storage. <Link href="/horoscope/subscription">Check access</Link> · <Link href="/kundli">Review birth profile</Link></div>
    <form className={styles.controls} onSubmit={event => {event.preventDefault(); setRequest({path: `/dailyinsight?${new URLSearchParams({day, language: locale})}`, owner: sessionFingerprint()}); resource.reload();}}>
      <label>Personalized day<select value={day} onChange={event => {setDay(event.target.value); setRequest(null);}}>{['yesterday', 'today', 'tomorrow'].map(value => <option key={value}>{value}</option>)}</select></label>
      <SelectLanguage value={locale} onChange={value => {setLocale(value); setRequest(null);}}/>
      <button className={styles.button} disabled={resource.busy}>Load my personalized reading</button>
    </form>
    <LoadingError resource={resource}/>
    {!requestPath && <p className={styles.fine}>Request a reading when ready. Generation may take a moment. Weekly, monthly and yearly personalized readings are not offered by this API.</p>}
    {resource.data && <section lang={text(object(generation.language).code) || locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-label="Your private reading">
      <p className={styles.fine}>Server entitlement: {text(object(resource.data.entitlement).status) || 'Not provided'} · Birth context: {Object.keys(vedic).length ? 'Engine context supplied' : 'Not provided'} · {text(object(generation.locale).localDate)}</p>
      <div className={styles.grid}>
        <TextCard title="Your daily reading" value={ai.shortReading}/><TextCard title="Advice" value={highlights.dailyAdvice || ai.dailyAdvice}/><TextCard title="Mood" value={highlights.mood || ai.mood}/><TextCard title="Focus" value={highlights.focus || ai.focusArea}/>
        {lifeAreas.map((area, index) => {const entry = object(area); return <TextCard key={index} title={text(entry.title) || 'Life area'} value={entry.description}/>;})}
        <TextCard title="Lucky colors" value={strings(lucky.colors).join(', ')}/><TextCard title="Lucky numbers" value={Array.isArray(lucky.numbers) ? lucky.numbers.filter(value => typeof value === 'number' || typeof value === 'string').join(', ') : ''}/>
        <TextCard title="Favorable activities" value={strings(guidance.favorableActivities).join('\n')}/><TextCard title="Activities to approach carefully" value={strings(guidance.avoidActivities).join('\n')}/>
      </div>
      {Array.isArray(object(vedic.transit).planets) && <details className={styles.card}><summary>Planetary influences returned by the Vedic engine</summary><ul>{(object(vedic.transit).planets as unknown[]).map((value, index) => {const planet = object(value); return <li key={index}>{text(planet.name)} · {text(planet.sign)} · {text(planet.nakshatra)}{planet.retrograde === true ? ' · Retrograde' : ''}</li>;})}</ul></details>}
      <p className={styles.fine}>Only returned fields are displayed. Interpretations do not alter the shared Kundli calculation data.</p>
    </section>}
  </>;
}

export function HoroscopeSubscription() {
  const plans = useHoroscopeResource('/subscription/plans');
  const current = useHoroscopeResource('/subscription/current', true);
  const preferences = useHoroscopeResource('/notifications/horoscope-preference', true);
  const [historyPath, setHistoryPath] = useState<string | null>(null);
  const history = useHoroscopeResource(historyPath, true);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  const mutation = useRef(0);
  useEffect(() => { const fence = mutation; const invalidate = () => {fence.current++; setMessage(''); setSaving(false);}; window.addEventListener('storage', invalidate); window.addEventListener('asp-auth-changed', invalidate); return () => {fence.current++; window.removeEventListener('storage', invalidate); window.removeEventListener('asp-auth-changed', invalidate);}; }, []);
  const plan = object((Array.isArray(plans.data?.data) ? plans.data.data : []).find(item => isDailyOffer(object(item))));
  const record = object(current.data?.data);
  const isDaily = object(record.subscriptionPlan).name === 'DAILY_HOROSCOPE_MONTHLY';
  const billing = object(current.data?.billing), preference = object(preferences.data?.data);
  const ready = preference.status === 'RECORDED';
  const rows = Array.isArray(history.data?.data) ? history.data.data : [];
  async function savePreference(enabled: boolean) {
    if (saving) return;
    const owner = sessionFingerprint(), run = ++mutation.current;
    setSaving(true); setMessage('');
    try {
      await horoscopeRequest('/notifications/horoscope-preference', true, {method: 'PATCH', body: JSON.stringify({enabled})});
      if (run === mutation.current && owner === sessionFingerprint()) {preferences.reload(); setMessage(enabled ? 'Explicit reminder consent saved.' : 'Reminders turned off.');}
    } catch { if (run === mutation.current && owner === sessionFingerprint()) setMessage('Preference was not confirmed. Refresh to check its status before retrying.'); }
    finally { if (run === mutation.current) setSaving(false); }
  }
  async function cancelAtPeriodEnd() {
    if (saving || billing.periodEndCancellationSupported !== true || !isDaily || billing.cancelAtPeriodEnd === true || !window.confirm('Request cancellation at the current period end? Existing access remains subject to the server entitlement.')) return;
    const owner = sessionFingerprint(), run = ++mutation.current; setSaving(true); setMessage('');
    try {
      await horoscopeRequest('/subscription/cancel', true, {method: 'POST', body: JSON.stringify({cancelAtPeriodEnd: true})});
      if (run === mutation.current && owner === sessionFingerprint()) {current.reload(); setMessage('Period-end cancellation request saved.');}
    } catch {if (run === mutation.current && owner === sessionFingerprint()) setMessage('Cancellation was not confirmed. Refresh subscription status before retrying.');}
    finally {if (run === mutation.current) setSaving(false);}
  }
  return <>
    <div className={styles.grid}>
      <section id="daily-horoscope-plan" className={styles.card}><h2>Personalized Daily Horoscope</h2><LoadingError resource={plans}/>
        {Object.keys(plan).length ? <><p>{planLabel(plan)}</p><p>{text(plan.description)}</p><p>Manual renewal. Automatic recurring billing is not offered as enabled.</p>{isDaily && record.subscriptionStatus === 'ACTIVE' ? <Link className={styles.button} href="/horoscope/personalized">Open your reading — no new payment needed</Link> : <HoroscopeCheckout plan={plan} onVerified={() => {current.reload(); preferences.reload();}}/>}</> : !plans.busy && <p>No active authoritative plan is available. Checkout is not offered here.</p>}
        <p className={styles.fine}>The approved product is USD $1 / 30 days. The server supplies the actual offer and controls checkout availability. Access is granted only after backend payment verification, never by a browser success callback.</p>
      </section>
      <section className={styles.card}><h2>Subscription status</h2><LoadingError resource={current}/>
        {current.data && (isDaily ? <><p>Status: {text(record.subscriptionStatus)}</p><p>Expires: {displayDate(record.endDate)}</p><p>Period-end cancellation: {billing.cancelAtPeriodEnd === true ? 'Requested' : 'Not requested'}</p><p>Renewal: {text(billing.renewalMode) || 'Not provided'}</p><p>Payment reference recorded: {record.razorpayPaymentId ? 'Yes' : 'Not recorded'}</p></> : <p>No Daily Horoscope subscription is returned as the latest subscription. Personalized access is always checked separately by the backend.</p>)}
        <div className={styles.controls}><button className={styles.button} disabled={current.busy} onClick={current.reload}>Refresh status</button><a className={styles.button} href="#daily-horoscope-plan">View plan / renewal options</a></div>
        {isDaily && billing.periodEndCancellationSupported === true && <button className={styles.button} disabled={saving || billing.cancelAtPeriodEnd === true} onClick={() => void cancelAtPeriodEnd()}>{billing.cancelAtPeriodEnd === true ? 'Period-end cancellation requested' : 'Request period-end cancellation'}</button>}
        <p className={styles.fine}>Pending, failed and expired states never unlock a reading. Full payment history/refund tracking is unavailable through the current customer subscription API; no history is fabricated.</p>
      </section>
    </div>
    <section className={styles.card}><h2>Daily reminder consent</h2><LoadingError resource={preferences}/>
      {preferences.data && <><p>Preference: {preference.enabled === true ? 'Opted in' : 'Off'} · Entitlement: {text(preference.subscriptionStatus)} · Delivery: {preference.deliveryReady === true ? 'Server configured; receipt unverified' : 'Not ready'}</p>
        {!ready && <p className={styles.notice}>The server has not activated reminder preferences. An existing subscriber does not need to pay again to resolve server rollout.</p>}
        {ready && preference.eligible !== true && <p>An active subscription is required to opt in. Existing consent can always be turned off while the preference service is available.</p>}
        <button className={styles.button} disabled={saving || !ready || (preference.enabled !== true && preference.eligible !== true)} onClick={() => void savePreference(preference.enabled !== true)}>{preference.enabled === true ? 'Turn reminders off' : 'I consent to daily reminders'}</button>
      </>}
      {message && <p role="status">{message}</p>}
      <p className={styles.fine}>Saving consent does not enable server rollout gates or register a browser push device. Existing Flutter FCM, language, quiet-hours and scheduling policy remain unchanged.</p>
    </section>
    <section className={styles.card} style={{marginTop: '1rem'}}><h2>Reading history</h2><button className={styles.button} disabled={history.busy} onClick={() => {setHistoryPath('/dailyinsight/history?limit=30'); history.reload();}}>Load my reading dates</button><LoadingError resource={history}/>
      {history.data && (rows.length ? <ul>{rows.map((row, index) => {const item = object(row); return <li key={index}>{text(item.date) || text(item.targetDate) || 'Recorded reading'}{text(item.language) ? ` · ${text(item.language)}` : ''}</li>;})}</ul> : <p>No saved reading history returned.</p>)}
    </section>
  </>;
}

function displayDate(value: unknown) { const date = new Date(text(value)); return Number.isNaN(date.getTime()) ? 'Not provided' : new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(date); }

export function HoroscopePlanPrice() {
  const resource = useHoroscopeResource('/subscription/plans');
  const plan = object((Array.isArray(resource.data?.data) ? resource.data.data : []).find(item => isDailyOffer(object(item))));
  return <span>{resource.busy ? 'Loading plan…' : Object.keys(plan).length ? planLabel(plan) : 'Check current plan'}{resource.error && <span className="block text-sm">Pricing unavailable</span>}</span>;
}
