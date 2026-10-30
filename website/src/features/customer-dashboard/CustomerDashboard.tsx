'use client';
import Link from 'next/link';
import {withAbort} from '@/features/auth/request-lifecycle';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicAstrologers, type PublicAstrologer } from '@/services/astrologerService';
import { customerSession, dashboardRequest, freeOffer, money, obj, owner, requestFreeChat, visiblePromotions, type Row } from './dashboard-api';
import { PromotionArt } from './PromotionArt';
import s from './dashboard.module.css';
import typography from './dashboard-typography.module.css';
const services = [['Kundli', 'Your owned reports', '/kundli', '◇'], ['Horoscope', 'Daily perspectives', '/horoscope', '☾'], ['Talk to Astrologer', 'Explore real profiles', '/astrologers', '✧'], ['Remedies', 'Supported guidance', '/remedies', '✦'], ['My Consultations', 'Chat and call history', '/consultations/history', '◷'], ['Soul Bazaar', 'Products and orders', '/marketplace/customer', '♧'], ['Subscriptions', 'Existing plans', '/subscriptions', '☆'], ['My Profile', 'Personal details', '/profile/complete', '○']];
type Data = {
    session: Row;
    wallet: Row;
    summary: Row;
    history: Row[];
    astrologers: PublicAstrologer[];
    partial: boolean;
    historyAvailable?:boolean;
    astrologersAvailable?:boolean;
};
export function CustomerDashboard() {
    const router = useRouter();
    const [data, setData] = useState<Data | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [index, setIndex] = useState(0), [hidden, setHidden] = useState(false), [selected, setSelected] = useState<PublicAstrologer | null>(null), [starting, setStarting] = useState(false), [uncertain, setUncertain] = useState(false), [chatError, setChatError] = useState(''),[refreshing,setRefreshing]=useState(false);
    const abort = useRef<AbortController | null>(null), generation = useRef(0), lock = useRef(false), mounted = useRef(false);
    const reading=useRef(false),lastData=useRef<Data|null>(null);
    const load = useCallback(async (accountChanged = false) => {
        // Refresh must not cancel an in-flight creation with an unknown outcome.
        // A true account change still immediately clears and fences private UI.
        if (lock.current && !accountChanged) return;
        if(reading.current&&!accountChanged)return;
        reading.current=true;
        let selectedId:string|undefined;try{const selected=JSON.parse(localStorage.getItem('asp_user')||'{}');if(selected.portal==='customer')selectedId=selected.id;}catch{}
        const retained=!accountChanged&&selectedId&&lastData.current&&obj(lastData.current.session.user).id===selectedId?lastData.current:null;
        const version = ++generation.current;
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        if(!retained){lastData.current=null;setData(null);setSelected(null);setIndex(0);}
        setError('');
        setLoading(!retained);setRefreshing(!!retained);
        const deadline=setTimeout(()=>controller.abort(),30000);
        setChatError('');
        try {
            const session = await withAbort(customerSession(controller.signal),controller.signal), identity = owner();
            const results = await withAbort(Promise.allSettled([dashboardRequest('/wallet', controller.signal), dashboardRequest('/consultations/summary', controller.signal), dashboardRequest('/consultations/history?page=1&limit=5', controller.signal), getPublicAstrologers({ page: 1, limit: 20, online: true }, controller.signal)]),controller.signal);
            if (!mounted.current || version !== generation.current || controller.signal.aborted || owner().snapshot !== identity.snapshot)
                return;
            const value = (i: number) => results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<Row>).value : {};
            const profile = obj(session.user);
            setHidden(sessionStorage.getItem('asp_dashboard_promo_dismissed_' + profile.id) === 'true');
            const unresolved = sessionStorage.getItem('asp_free_chat_unresolved_' + profile.id) === 'true';
            setUncertain(unresolved);
            if (unresolved) setChatError('An earlier request has an unconfirmed outcome. Review My Consultations before another request; automatic retries are disabled.');
            const astro = results[3].status === 'fulfilled' ? results[3].value.data : [];
            const nextData:Data={ session, wallet: obj(value(0).data), summary: obj(value(1).data), history: Array.isArray(value(2).data) ? value(2).data as Row[] : [], astrologers: Array.isArray(astro) ? astro.filter(a => a.isVerified === true && a.isOnline === true && a.isBusy !== true && a.userId && a.userId !== profile.id).slice(0, 5) : [], partial: results.some(r => r.status === 'rejected'),historyAvailable:results[2].status==='fulfilled'&&Array.isArray(value(2).data),astrologersAvailable:results[3].status==='fulfilled'&&Array.isArray(astro) };lastData.current=nextData;setData(nextData);
        }
        catch (e) {
            if (mounted.current && version === generation.current) {
                const issue=e&&typeof e==='object'?e as {name?:unknown;message?:unknown}:{};
                const temporary=['TypeError','AbortError','TimeoutError'].includes(String(issue.name))||/temporarily unavailable|timed out|timeout|Verification unavailable/.test(String(issue.message));
                let same=false;try{const user=JSON.parse(localStorage.getItem('asp_user')||'{}');same=user.portal==='customer'&&user.id===selectedId;}catch{}
                if(!(retained&&temporary&&same)){lastData.current=null;setData(null);}
                setError(issue.message === 'CUSTOMER_LOGIN_REQUIRED' ? 'Sign in with your authorized Customer account to open your dashboard.' : 'Your dashboard could not be verified. Check your connection and retry.');
            }
        }
        finally {
            clearTimeout(deadline);
            if (mounted.current && version === generation.current){reading.current=false;setLoading(false);setRefreshing(false);}
        }
    }, []);
    useEffect(() => { const lifecycle=generation; mounted.current = true; void load(); const refresh = () => { void load(); }; const accountChanged = (event?:Event) => {const key=(event as StorageEvent|undefined)?.key;if(key&&!['asp_user','asp_customer_access_token','asp_access_token'].includes(key))return;void load(true); }; window.addEventListener('asp-auth-changed', accountChanged); window.addEventListener('storage', accountChanged); window.addEventListener('focus', refresh);window.addEventListener('asp-wallet-changed',refresh);window.addEventListener('asp-consultation-changed',refresh); const timer = setInterval(() => { if (document.visibilityState === 'visible')
        void load(); }, 60000); return () => { mounted.current = false; lifecycle.current++; reading.current=false; abort.current?.abort(); clearInterval(timer); window.removeEventListener('asp-auth-changed', accountChanged); window.removeEventListener('storage', accountChanged); window.removeEventListener('focus', refresh);window.removeEventListener('asp-wallet-changed',refresh);window.removeEventListener('asp-consultation-changed',refresh); }; }, [load]);
    const offer = data ? freeOffer(data.session) : { eligible: false, minutes: 0 }, promos = visiblePromotions(offer.eligible), promotion = promos[index % promos.length], profile = obj(data?.session.user), name = typeof profile.name === 'string' ? profile.name : typeof profile.fullName === 'string' ? profile.fullName : 'Welcome';
    async function start() { if (!selected?.userId || lock.current || uncertain)
        return; lock.current = true; setStarting(true); setChatError(''); const version = generation.current; const controller = abort.current; if (!controller) {
        lock.current = false;
        setStarting(false);
        return;
    } const requestOwner = String(obj(data?.session.user).id || ''); try {
        const call = await requestFreeChat(selected.userId, controller.signal, () => {
            setUncertain(true);
            sessionStorage.setItem('asp_free_chat_unresolved_' + requestOwner, 'true');
        });
        sessionStorage.removeItem('asp_free_chat_unresolved_' + requestOwner);
        if (mounted.current && version === generation.current) {
            setData(null);
            router.push('/chat/' + encodeURIComponent(String(call.id)));
        }
    }
    catch {
        if (mounted.current && version === generation.current) {
            const unresolved = sessionStorage.getItem('asp_free_chat_unresolved_' + requestOwner) === 'true';
            setUncertain(unresolved);
            setSelected(null);
            setChatError(unresolved ? 'The request could not be confirmed. Check My Consultations before retrying. No paid fallback was requested.' : 'Free Chat eligibility could not be verified. Refresh and retry. No consultation request was sent.');
        }
    }
    finally {
        lock.current = false;
        if (mounted.current)
            setStarting(false);
    } }
    function dismiss() { if (!data)
        return; sessionStorage.setItem('asp_dashboard_promo_dismissed_' + obj(data.session.user).id, 'true'); setHidden(true); }
    const stats = [['Wallet balance', money(data?.wallet.availableBalance ?? data?.wallet.balance, data?.wallet.currency,profile.countryCode)], ['Active consultations', typeof data?.summary.active === 'number' ? String(data.summary.active) : 'Unavailable'], ['Completed consultations', typeof data?.summary.completed === 'number' ? String(data.summary.completed) : 'Unavailable'], ['Total consultation spend', money(data?.summary.recordedSpend, data?.summary.currency,profile.countryCode)]];
    return <main className={s.page+' '+typography.type}><div className={s.container}>
 <div className={s.topline}><span>YOUR PERSONAL SPACE</span><Link href="/wallet" className={s.wallet}>Wallet · {loading ? 'Loading…' : stats[0][1]}</Link></div>
 <section className={s.hero}><div><p className={s.eyebrow}>A MOMENT FOR YOU</p><h1>{data ? `${name}, find your perspective.` : 'Your journey, thoughtfully guided.'}</h1><p>Explore your available readings, real astrologers and conversations. At your pace.</p><div className={s.links}><Link href="/astrologers">Explore astrologers ↗</Link><Link href="/kundli">My Kundli</Link></div></div><div className={s.heroArt}><PromotionArt kind="daily"/></div></section>
 {error && <div role="alert" className={s.notice}><p>{error}</p>{data&&<p>Last verified figures remain visible. Refresh before relying on them; no balance was changed.</p>}<button onClick={() => void load()} disabled={loading}>Retry</button><Link href="/login?redirectTo=%2Fdashboard">Customer Login</Link></div>}
 {data?.partial && <div className={s.notice} role="status">Some information is unavailable. Totals are never estimated. <button onClick={() => void load()}>Retry</button></div>}
 <section aria-label="Your account statistics" className={s.stats}>{stats.map(([label, value]) => <article key={label}><p>{label}</p><strong>{loading ? <span className={s.skeleton} aria-label="Loading"/> : value}</strong>{label === 'Total consultation spend' && <small>Recorded charges on completed/ended consultations{typeof data?.summary.currency==='string'?' · '+data.summary.currency:''}; not pending reservations.</small>}</article>)}</section>
 <div className={s.columns}><div className={s.primary}>
 <section className={s.section}><div className={s.sectionHeading}><div><p className={s.eyebrow}>EXPLORE YOUR POSSIBILITIES</p><h2>Quick Access</h2></div><button disabled={loading || refreshing || starting} onClick={() => void load()} aria-label="Refresh dashboard">{refreshing?'Refreshing…':'↻ Refresh'}</button></div><div className={s.services}>{services.map(([title, detail, href, icon]) => <Link href={href} key={title}><span aria-hidden="true">{icon}</span><strong>{title}</strong><small>{detail}</small></Link>)}</div></section>
 {data && !hidden && <section className={s.promotion} aria-label="Personal discovery promotion"><button className={s.close} onClick={dismiss} aria-label="Dismiss promotions for this session">×</button><div className={s.promoArt}><PromotionArt kind={promotion.id}/><small>Celestial illustration</small></div><div><p className={s.eyebrow}>A LITTLE INSPIRATION</p><h2>{promotion.title}</h2><p>{promotion.id === 'free' ? `${offer.minutes} minute${offer.minutes === 1 ? '' : 's'} available according to your current entitlement. Final eligibility is checked again before requesting chat.` : promotion.detail}</p><Link href={promotion.href}>{promotion.id === 'free' ? 'Choose an available astrologer' : 'Explore'} ↗</Link><nav className={s.promoNav} aria-label="Promotion navigation"><button onClick={() => setIndex((index + promos.length - 1) % promos.length)} aria-label="Previous promotion">←</button><span>{index % promos.length + 1} / {promos.length}</span><button onClick={() => setIndex((index + 1) % promos.length)} aria-label="Next promotion">→</button></nav></div></section>}
 <section className={s.section}><div className={s.sectionHeading}><h2>Consultation Overview</h2><Link href="/consultations/history">View all ↗</Link></div>{loading ? <div className={s.skeleton} role="status">Loading your consultations…</div> : !data ? <p>Sign in to view your records.</p> : data.historyAvailable===false?<p>Consultation history could not be loaded. Use Refresh to retry.</p>: data.history.length === 0 ? <p>No consultation records returned. <Link href="/astrologers">Explore astrologers</Link></p> : <div className={s.history}>{data.history.map(c => <article key={String(c.id)}><div><strong>{String(obj(obj(c.astrologer).userProfile).fullName || obj(c.astrologer).name || 'Astrologer')}</strong><p>{String(c.mode || 'Consultation')} · {String(c.status)}{c.isFreeChat === true ? ' · Free Chat' : ''}</p><small>{typeof c.createdAt === 'string' ? new Date(c.createdAt).toLocaleDateString() : ''}</small></div><Link href={c.mode === 'chat' ? '/chat/' + encodeURIComponent(String(c.id)) : '/consultations/' + encodeURIComponent(String(c.id))}>Open ↗</Link></article>)}</div>}</section>
 </div><aside className={s.guidance} id="free-chat"><p className={s.eyebrow}>REAL CONNECTIONS</p><h2>Find your guide</h2><p>Verified profiles currently returned as online and not busy. Availability is checked again by the server.</p>{offer.eligible && <div className={s.offer}>Your Free Chat is available. Choose a profile, then confirm a free-only request.</div>}{loading ? <p role="status">Checking availability…</p> : data?.astrologersAvailable===false?<p>Availability could not be loaded. Refresh before choosing a profile.</p>:data?.astrologers.length ? data.astrologers.map(a => <article className={s.astrologer} key={a.id}><div><Link href={'/astrologers/' + encodeURIComponent(a.id)}><strong>{a.name}</strong></Link><small>Verified · Online</small><small>{a.languages.join(', ')}</small></div>{offer.eligible ? <button disabled={starting || uncertain || !!error} onClick={() => { setSelected(a); setChatError(''); }}>Free Chat</button> : <Link href={'/astrologers/' + encodeURIComponent(a.id)}>View profile</Link>}</article>) : <p>No available profiles returned. <Link href="/astrologers">Browse profiles</Link></p>}
 {selected && <div className={s.confirm} role="region" aria-label="Confirm free chat"><h3>Request Free Chat with {selected.name}?</h3><p>Free-only request. No paid fallback. The timer starts after acceptance and the backend controls expiry. A request may consume your first-chat offer under existing rules.</p><button disabled={starting || uncertain} onClick={() => void start()}>{starting ? 'Requesting…' : 'Confirm free-only chat'}</button><button disabled={starting} onClick={() => setSelected(null)}>Cancel</button></div>}{chatError && <p className={s.notice} role="alert">{chatError} <Link href="/consultations">My Consultations</Link></p>}
 <Link href="/astrologers" className={s.allGuides}>All astrologers ↗</Link><p className={s.fine}>Other consultations require their existing explicit pricing and confirmation flow. No booking starts by browsing.</p></aside></div>
 </div></main>;
}
