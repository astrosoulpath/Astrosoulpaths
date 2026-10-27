"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/features/admin/auth/admin-session";
import { readNotificationResponse } from "./storage-response";
import styles from "./notification-panel.module.css";

type Policy={category:string;approved:boolean;enabled:boolean;languages:string[];controlVersion:number;dailyLimit:number;minimumIntervalMs:number;quietStart:number;quietEnd:number;scheduleMinute:number};
const locales="en hi bn ta te mr gu kn ml pa es fr de pt it ja ko zh ar ru".split(" ");
export default function PolicyManager(){
 const [rows,setRows]=useState<Policy[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[reviewed,setReviewed]=useState(false);
 const [loading,setLoading]=useState(true),[success,setSuccess]=useState("");
 const [category,setCategory]=useState("love"),[locale,setLocale]=useState("en"),[preview,setPreview]=useState<{title:string;interpretation:string;source:string;locale:string}|null>(null);
 const [metrics,setMetrics]=useState<{engagementTrackingEnabled:boolean;meaning:string;rows:{category:string;locale:string;state:string;deliveries:number;uniqueAuthorizedViews:number}[]}|null>(null);
 async function inspectMetrics(){try{const response=await adminFetch('/admin/notifications/policies/metrics');if(!response.ok)throw new Error();const result=await response.json();setMetrics(result.data);}catch{setError("Aggregate delivery metrics could not be loaded.");}}
 async function load(){setLoading(true);setError("");try{const response=await adminFetch('/admin/notifications/policies');const data=await readNotificationResponse<Policy[]>(response);if(!Array.isArray(data))throw new Error("Invalid policy response. Reload before editing.");setRows(data);}finally{setLoading(false);}}
 useEffect(()=>{void load().catch(error=>setError(error instanceof Error?error.message:"Policy storage could not be loaded."));},[]);
 function edit(index:number,patch:Partial<Policy>){setRows(old=>old.map((p,i)=>i===index?{...p,...patch}:p));}
 async function save(policy:Policy,disable=false){setBusy(true);setError("");setSuccess("");try{
  const response=await adminFetch(`/admin/notifications/policies/${policy.category}${disable?'/disable':''}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(disable?{}:{...policy,enabled:policy.enabled,languageReviewConfirmed:reviewed})});
  await readNotificationResponse(response);await load();setSuccess("Controls saved and reloaded. Runtime delivery gates are unchanged.");
 }catch(error){setError(error instanceof Error?error.message:"Update unavailable. Reload before retrying.");}finally{setBusy(false);}}
 async function showPreview(){setBusy(true);setPreview(null);try{const response=await adminFetch(`/admin/notifications/policies/preview/${category}/${locale}`);if(!response.ok)throw new Error();const result=await response.json();setPreview(result.data);}catch{setError("No verified preview is available for this category/language.");}finally{setBusy(false);}}
 return <section className={`${styles.panel} space-y-4`}><h2 className="text-2xl font-semibold">Mobile notification controls</h2>
 <p>Flutter Android/iOS only. Category controls cannot approve entitlement, customer consent or runtime rollout. Disabling cancels access and blocks queued sends at the next authorization check; provider-accepted notifications cannot be recalled.</p>
 {error&&<p role="alert" className={styles.error}>{error}</p>}{success&&<p role="status" className={styles.success}>{success}</p>}{loading&&<p role="status">Loading policy storage...</p>}{!loading&&!error&&rows.length===0&&<p>No category policies are installed. Install a reviewed, disabled policy before saving drafts. No delivery is enabled.</p>}<button disabled={busy||loading} onClick={()=>void load().catch(error=>setError(error instanceof Error?error.message:"Policies could not be reloaded."))}>Reload controls</button>
 <button disabled={busy} onClick={()=>void inspectMetrics()}>Inspect aggregate delivery and views</button>
 {metrics&&<div className="overflow-auto"><p>{metrics.meaning}. Tracking: {metrics.engagementTrackingEnabled?'enabled by separate privacy approval':'disabled'}.</p><table><thead><tr><th>Category</th><th>Language</th><th>Delivery state</th><th>Count</th><th>Unique authorized views</th></tr></thead><tbody>{metrics.rows.map(row=><tr key={`${row.category}:${row.locale}:${row.state}`}><td>{row.category}</td><td>{row.locale}</td><td>{row.state}</td><td>{row.deliveries}</td><td>{row.uniqueAuthorizedViews}</td></tr>)}</tbody></table></div>}
 <div className="flex flex-wrap gap-3"><label>Preview category<select value={category} onChange={e=>setCategory(e.target.value)}>{['love','career','marriage','prosperity','education','growth','family','yoga'].map(c=><option key={c}>{c}</option>)}</select></label>
 <label>Preview language<select value={locale} onChange={e=>setLocale(e.target.value)}>{locales.map(l=><option key={l}>{l}</option>)}</select></label><button disabled={busy} onClick={()=>void showPreview()}>Preview synthetic local chart</button></div>
 {preview&&<div lang={preview.locale} dir={preview.locale==='ar'?'rtl':'auto'} className="rounded-lg border p-4"><p>Synthetic calculation preview; never a customer chart or a queued notification.</p><h3>{preview.title}</h3><p className="whitespace-pre-wrap">{preview.interpretation}</p></div>}
 <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I have reviewed the selected language templates. Linguistic review does not authorize production rollout.</label>
 {rows.map((policy,index)=><fieldset key={policy.category} disabled={busy||loading||!!error} className="space-y-3 rounded-lg border p-4"><legend>{policy.category} · control revision {policy.controlVersion}</legend>
 <p>Business policy: {policy.approved?'approved separately':'not approved'}</p><label><input type="checkbox" checked={policy.enabled} onChange={e=>edit(index,{enabled:e.target.checked})}/> Category enabled</label>
 <div className="flex flex-wrap gap-3">{locales.map(l=><label key={l}><input type="checkbox" checked={policy.languages.includes(l)} onChange={e=>edit(index,{languages:e.target.checked?[...policy.languages,l]:policy.languages.filter(v=>v!==l)})}/>{l}</label>)}</div>
 <div className="grid gap-3 md:grid-cols-2">{([['dailyLimit','Per-user daily cap',1,10],['minimumIntervalMs','Minimum interval (milliseconds)',3600000,2147483647],['quietStart','Quiet hours start (local minute)',0,1439],['quietEnd','Quiet hours end (local minute)',0,1439],['scheduleMinute','Earliest generation (local minute)',0,1439]] as const).map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} value={policy[key]} onChange={e=>edit(index,{[key]:Number(e.target.value)})}/></label>)}</div>
 <p>Natal insights are generated once per explicit consent revision, after the local start time. This is not a recurring forecast of new events.</p>
 <button onClick={()=>void save(policy)}>Save controls</button>{' '}<button onClick={()=>void save(policy,true)}>Disable category now</button>
 </fieldset>)}
 </section>;
}
