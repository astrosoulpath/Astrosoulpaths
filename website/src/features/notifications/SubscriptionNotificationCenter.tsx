'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, RefreshCw, Sparkles } from 'lucide-react';
import { sessionCandidate } from '../auth/public-auth';
import { subscriptionPath, subscriptionProgress, subscriptionRequest, type SubscriptionReminderState, type SubscriptionRole } from './subscription-api';
import s from './subscription-notifications.module.css';

function useReminders(role: SubscriptionRole) {
  const [data,setData] = useState<SubscriptionReminderState|null>(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const controller=useRef<AbortController|null>(null), sequence=useRef(0);
  const load=useCallback(async()=>{
    const generation=++sequence.current;
    controller.current?.abort(); const request=new AbortController();controller.current=request;
    setBusy(true);setError('');setData(null);
    try {const result=await subscriptionRequest(role,request.signal);if(generation===sequence.current&&!request.signal.aborted)setData(result);}
    catch(error){if(generation===sequence.current&&!request.signal.aborted)setError(error instanceof Error?error.message:'Unable to connect. Please retry.');}
    finally{if(generation===sequence.current&&!request.signal.aborted)setBusy(false);}
  },[role]);
  useEffect(()=>{
    const snapshot=sessionCandidate(subscriptionPath(role))?.snapshot;
    void load();
    const changed=()=>{sequence.current++;controller.current?.abort();setData(null);setError('Account changed. Reopen notifications.');setBusy(false);};
    const check=()=>{if(sessionCandidate(subscriptionPath(role))?.snapshot!==snapshot)changed();};
    window.addEventListener('asp-auth-changed',changed);window.addEventListener('storage',check);
    const timer=setInterval(check,1000);
    return()=>{controller.current?.abort();clearInterval(timer);window.removeEventListener('asp-auth-changed',changed);window.removeEventListener('storage',check);};
  },[load,role]);
  return {data,error,busy,load};
}
export function SubscriptionNotificationBell({role}:{role:SubscriptionRole}) {
  const {data}=useReminders(role);
  return <Link href={subscriptionPath(role)} className={s.bell} aria-label={`Subscription notifications${data ? `, ${data.unreadCount} unread` : ''}`}><Bell size={20}/>{!!data?.unreadCount&&<span>{data.unreadCount>99?'99+':data.unreadCount}</span>}</Link>;
}
export default function SubscriptionNotificationCenter({role}:{role:SubscriptionRole}) {
  const {data,error,busy,load}=useReminders(role);
  const [saving,setSaving]=useState(false),[actionError,setActionError]=useState('');
  const actionRef=useRef<AbortController|null>(null);
  const [clock,setClock]=useState<{source:string;elapsed:number}|null>(null);
  useEffect(()=>{
    if(!data)return;
    const source=data.serverNow,started=performance.now();
    const timer=setInterval(()=>setClock({source,elapsed:performance.now()-started}),30000);
    return()=>clearInterval(timer);
  },[data]);
  useEffect(()=>()=>actionRef.current?.abort(),[]);
  const act=async(path:string,body:unknown)=>{
    if(saving||busy)return;
    setSaving(true);setActionError('');const request=new AbortController();actionRef.current=request;
    try {await subscriptionRequest(role,request.signal,path,body);await load();}
    catch(error){if(!request.signal.aborted)setActionError(error instanceof Error?error.message:'Unable to save.');}
    finally{if(!request.signal.aborted)setSaving(false);}
  };
  const progress=data?subscriptionProgress(data,Date.parse(data.serverNow)+(clock?.source===data.serverNow?clock.elapsed:0)):null;
  return <main className={s.page}>
    <header className={s.heading}><div><p className={s.eyebrow}>ASTRO SOUL PATH · {role}</p><h1>Subscription notifications</h1><p>Your subscription, renewal reminders and phone preferences.</p></div><button type="button" disabled={busy||saving} onClick={()=>void load()} aria-label="Refresh reminders"><RefreshCw size={18}/></button></header>
    {busy&&<p role="status">Loading your subscription…</p>}
    {(error||actionError)&&<p role="alert" className={s.error}>{error||actionError}</p>}
    {data&&<>
      <section className={s.card} aria-labelledby="subscription-title"><Sparkles className={s.gold}/><p className={s.eyebrow}>{data.subscription?.status||'NO SUBSCRIPTION'}</p><h2 id="subscription-title">{data.product.title}</h2>
        {progress&&<><p className={s.countdown}>{progress.days===0?'Period ended':`${progress.days} days remaining`}</p><p>Exact expiry: <time dateTime={progress.expiry.toISOString()}>{progress.expiry.toLocaleString()}</time></p><progress value={progress.progress} max="1" aria-label="Subscription time remaining"/></>}
        {!data.subscription&&<p>No subscription has been purchased for this account.</p>}
        {data.subscription?.status==='EXPIRED'&&<p>Renew to resume {role==='CUSTOMER'?'personalized daily readings':'authorized Professional Kundli generation'}.</p>}
        <Link className={s.renew} href={role==='CUSTOMER'?'/horoscope/subscription':'/subscriptions'}>{role==='CUSTOMER'?'Renew for $1':'Renew Professional Kundli · ₹3,500'}</Link>
        <p className={s.note}>No automatic charge. Access extends only after verified payment.</p>
      </section>
      <section className={s.card}><h2>Phone reminder preferences</h2><p>Only your registered, authorized phones can receive reminders. Website sign-in does not grant phone notification permission.</p>
        {!data.schemaReady&&<p role="status">Reminder storage is awaiting activation. Delivery remains disabled.</p>}
        <form onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void act('/preference',{pushEnabled:form.get('enabled')==='on',timezone:form.get('timezone'),quietStart:Number(form.get('quietStart')),quietEnd:Number(form.get('quietEnd'))});}} key={JSON.stringify(data.preference)}>
          <label><input type="checkbox" name="enabled" defaultChecked={data.preference.pushEnabled} disabled={!data.schemaReady||saving}/> Allow subscription expiry reminders on registered phones</label>
          <div className={s.fields}><label>Timezone<input name="timezone" required maxLength={100} defaultValue={data.preference.timezone} placeholder="Asia/Kolkata" disabled={!data.schemaReady||saving}/></label><label>Quiet hours start<input type="number" name="quietStart" min="0" max="23" required defaultValue={data.preference.quietStart} disabled={!data.schemaReady||saving}/></label><label>Quiet hours end<input type="number" name="quietEnd" min="0" max="23" required defaultValue={data.preference.quietEnd} disabled={!data.schemaReady||saving}/></label></div>
          <button type="submit" disabled={!data.schemaReady||saving||busy}>{saving?'Saving…':'Save preferences'}</button>
        </form>
      </section>
      <section className={s.card}><h2>Reminder history <span className={s.note}>· {data.unreadCount} unread</span></h2>
        {!data.reminders.length&&<p>No subscription reminders yet.</p>}
        {data.reminders.map(item=><article key={item.id} className={s.reminder}><Bell aria-hidden="true" size={20}/><div><h3>{item.title}{!item.readAt&&<span className={s.unread}> Unread</span>}</h3><p>{item.body}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>{!item.readAt&&<button type="button" disabled={saving||busy} onClick={()=>void act('/'+encodeURIComponent(item.id)+'/read',{})}>Mark read</button>}</article>)}
      </section>
    </>}
  </main>;
}
