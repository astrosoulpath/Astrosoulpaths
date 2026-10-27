"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "./auth/admin-session";
type Row={locale:string;state:string;failureCode:string|null;count:number;attempts:number};
type Monitoring={schedulerStatus?:string;providerConfigured?:boolean;active:number;expired:number;pending:number;durableStatus:string;generation:Row[];delivery:Row[];paymentScope:string;
  paymentStates:Array<{currency:string;status:string;_count:{id:number};_sum:{amount:string|number|null}}>};
export function HoroscopeMonitoringPanel(){
  const [data,setData]=useState<Monitoring|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);setError(false);setData(null);void adminFetch('/admin/horoscope/monitoring',{signal:controller.signal}).then(async r=>{
    if(!r.ok)throw Error('Unavailable');const body=await r.json();if(!body.success)throw Error('Unavailable');if(active)setData(body.data);
  }).catch(()=>{if(active)setError(true);}).finally(()=>clearTimeout(timer));return()=>{active=false;clearTimeout(timer);controller.abort();};},[attempt]);
  return <section aria-label="Personalized horoscope monitoring" className="my-6 rounded-xl border bg-white p-4 text-slate-900">
    <h2 className="text-xl font-semibold">Personalized horoscope monitoring</h2>
    {error?<div><p role="alert">Monitoring unavailable. No totals are estimated.</p><button type="button" className="asp-admin-back-btn" onClick={()=>setAttempt(value=>value+1)}>Retry monitoring</button></div>:!data?<p role="status">Loading monitoring…</p>:<>
      <p>Active: {data.active} · Expired: {data.expired} · Pending purchases/renewals: {data.pending}</p>
      <p>Scheduler configuration: {data.schedulerStatus??'Unavailable'}. Firebase initialization: {data.providerConfigured===true?'Configured':'Not confirmed'}. This is configuration, not proof of a running worker or device delivery.</p>
      <p>Pause/resume requires the reviewed operational activation procedure; no unaudited toggle is offered.</p>
      <p>Durable generation/delivery: {data.durableStatus}. FCM accepted does not mean device displayed.</p>
      {([['Generation',data.generation],['Delivery',data.delivery]] as const).map(([title,rows])=><div key={title} className="my-4 overflow-x-auto">
        <h3>{title} by language</h3><table className="w-full text-left text-sm"><thead><tr><th>Locale</th><th>State</th><th>Jobs</th><th>Attempts</th><th>Failure classification</th></tr></thead>
          <tbody>{rows.map(r=><tr key={`${r.locale}:${r.state}:${r.failureCode}`}><td>{r.locale}</td><td>{r.state}</td><td>{r.count}</td><td>{r.attempts}</td><td>{r.failureCode??'None recorded'}</td></tr>)}</tbody></table>
      </div>)}
      <p>Gateway payment records ({data.paymentScope}); collections are not earned revenue.</p>
      {data.paymentStates.map(r=><p key={`${r.currency}:${r.status}`}>{r.currency} · {r.status} · {r._count.id} orders · {String(r._sum.amount??'Unavailable')}</p>)}
    </>}
  </section>;
}
