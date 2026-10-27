"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "@/features/admin/auth/admin-session";
import { readNotificationResponse } from "./storage-response";
import styles from "./notification-panel.module.css";
import { campaignExpired, notificationUtcDate } from "./campaign-presentation";

type Campaign = {id:string;category:string;locale:string;title:string;body:string;state:string;revision:number;expiresAt:string};
type CampaignStatus = {audit:{action:string;createdAt:string}[];deliveries:{state:string;count:number}[]};
const locales = "en hi bn ta te mr gu kn ml pa es fr de pt it ja ko zh ar ru".split(" ");
export default function CampaignManager({categories}:{categories:{id:string;label:string}[]}) {
  const [rows,setRows]=useState<Campaign[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [category,setCategory]=useState("love"),[locale,setLocale]=useState("en"),[title,setTitle]=useState(""),[body,setBody]=useState(""),[expiry,setExpiry]=useState(""),[schedule,setSchedule]=useState("");
  const [status,setStatus]=useState<{id:string;data:CampaignStatus}|null>(null);
  const [reviewed,setReviewed]=useState<string[]>([]);
  const [success,setSuccess]=useState("");
  const [editing,setEditing]=useState<{id:string;revision:number}|null>(null);
  const inFlight=useRef(false);
  const pendingDraft=useRef<{payload:string;requestId:string}|null>(null);
  const [storage,setStorage]=useState<{schemaGateEnabled:boolean;tablesReady:boolean;missingTables:string[]}|null>(null);
  const inspection=useRef(0);
  async function inspectStorage(){
    try{const response=await adminFetch('/admin/notifications/campaigns/storage-readiness');setStorage(await readNotificationResponse(response));}
    catch{setError('Storage readiness could not be loaded. Verify the backend version and Admin session; no configuration was changed.');}
  }
  async function inspect(id:string) {
    const generation=++inspection.current;setStatus(null);
    try {const response=await adminFetch(`/admin/notifications/campaigns/${id}/status`);const data=await readNotificationResponse<CampaignStatus>(response);if(!Array.isArray(data?.audit)||!Array.isArray(data?.deliveries))throw new Error();if(generation===inspection.current){setStatus({id,data});setError("");}}
    catch {if(generation===inspection.current)setError("Delivery status could not be loaded. Reload before taking action.");}
  }
  const load=useCallback(async()=>{
    setReady(false);setRows([]);
    const response=await adminFetch("/admin/notifications/campaigns");
    const data=await readNotificationResponse<Campaign[]>(response); if(!Array.isArray(data)) throw new Error("Invalid campaign response. Reload before editing.");
    setRows(data);setReviewed([]);setReady(true);setError("");
  },[]);
  useEffect(()=>{void load().catch(error=>setError(error instanceof Error?error.message:"Campaign storage unavailable."));},[load]);
  async function mutate(path:string,value:object) {
    if(inFlight.current)return;
    inFlight.current=true;
    setBusy(true);setError("");setSuccess("");
    try {const response=await adminFetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
      await readNotificationResponse(response);await load();setEditing(null);setSuccess("Saved and reloaded from storage. Delivery has not been enabled.");
      if(path.endsWith('/campaigns')||path.endsWith('/draft')){setTitle("");setBody("");setExpiry("");pendingDraft.current=null;}
    } catch(error) {setError(error instanceof Error?error.message:"Request unavailable. Reload before retrying; a timed-out request may have completed.");}
    finally {inFlight.current=false;setBusy(false);}
  }
  function isoDate(value:string) {
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()) || date.getTime()<=Date.now()) {setError("Choose a valid future local date and time.");return null;}
    return date.toISOString();
  }
  function create(event:FormEvent) {
    event.preventDefault();if(inFlight.current)return;
    const expiresAt=isoDate(expiry);
    if(!expiresAt)return;
    if(new Date(expiresAt).getTime()>Date.now()+31*86400000){setError("Expiry must be within 31 days.");return;}
    const value={category,locale,title,body,expiresAt};
    if(editing){void mutate(`/admin/notifications/campaigns/${editing.id}/draft`,{...value,revision:editing.revision});return;}
    const payload=JSON.stringify(value);
    if(pendingDraft.current?.payload!==payload)pendingDraft.current={payload,requestId:crypto.randomUUID()};
    void mutate("/admin/notifications/campaigns",{...value,requestId:pendingDraft.current.requestId});
  }
  function selectDraft(row:Campaign,edit:boolean){
    setTitle(row.title);setBody(row.body);setLocale(row.locale);setCategory(row.category);
    const date=new Date(row.expiresAt);setExpiry(new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16));
    setEditing(edit?{id:row.id,revision:row.revision}:null);pendingDraft.current=null;setSuccess("");
  }
  return <section className={`${styles.panel} space-y-4`}><h2 className="text-2xl font-semibold">Editorial campaigns</h2>
    <p>Draft → approval → schedule. These controls never activate delivery or override customer consent. Templates contain general editorial content, not personal chart findings. To revise approved content, create a new draft.</p>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{success&&<p role="status" className={styles.success}>{success}</p>}
    {!ready&&!error&&<p role="status">Loading campaign storage…</p>}
    {ready&&rows.length===0&&<p>No campaigns yet. Saving a draft does not enable delivery.</p>}
    <button type="button" disabled={busy} onClick={()=>void load().catch(error=>setError(error instanceof Error?error.message:"Campaigns could not be loaded."))}>Reload campaigns</button>
    <button type="button" disabled={busy} onClick={()=>void inspectStorage()}>Inspect storage prerequisites</button>
    {storage&&<p role="status">Schema gate: {storage.schemaGateEnabled?'configured':'not activated'}. Tables: {storage.tablesReady?'present; constraint and migration review still required':`missing ${storage.missingTables.join(', ')}`}. This check cannot activate storage or delivery.</p>}
    <form onSubmit={create} className="grid gap-3 md:grid-cols-2"><fieldset disabled={!ready||busy} className="contents">
      {editing&&<p className="md:col-span-2">Editing draft revision {editing.revision}. Approval is required again after review.</p>}
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label>Language<select value={locale} onChange={e=>setLocale(e.target.value)}>{locales.map(l=><option key={l}>{l}</option>)}</select></label>
      <label>Title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Expires (local time)<input required type="datetime-local" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
      <label className="md:col-span-2">Editorial text<textarea required rows={6} maxLength={3000} value={body} onChange={e=>setBody(e.target.value)}/></label>
      <button type="submit" className={styles.primary}>{busy?"Saving...":editing?"Save draft changes":"Save draft"}</button>
      <button type="button" onClick={()=>{setEditing(null);setTitle("");setBody("");setExpiry("");pendingDraft.current=null;}}>Start new draft</button>
    </fieldset></form>
    <label>Schedule time (local time)<input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}/></label>
    {rows.map(row=><article key={row.id} dir={row.locale==="ar"?"rtl":"ltr"} className="min-w-0 space-y-2 break-words rounded-lg border p-4"><h3>{row.title}</h3><p>{row.body}</p><p>{row.category} · {row.locale} · <span className={styles.badge}>{row.state}</span> · revision {row.revision}</p><p>Expires: <time dateTime={row.expiresAt}>{notificationUtcDate(row.expiresAt)}</time></p>{campaignExpired(row.expiresAt)&&<p>Expired or invalid expiry. New approval and scheduling are unavailable; server validation remains authoritative.</p>}
      <button disabled={busy} onClick={()=>void inspect(row.id)}>Delivery status and audit</button>{" "}
      <button disabled={busy} onClick={()=>selectDraft(row,false)}>Use as draft template</button>{" "}
      {row.state==="DRAFT"&&<button disabled={busy} onClick={()=>selectDraft(row,true)}>Edit draft</button>}{" "}
      {row.state==="DRAFT"&&<><label className="block"><input type="checkbox" checked={reviewed.includes(row.id)} onChange={e=>setReviewed(ids=>e.target.checked?[...ids,row.id]:ids.filter(id=>id!==row.id))}/> I reviewed this exact draft and language: no invented chart facts or yogas, guaranteed outcomes, claims about another person’s thoughts, financial or medical promises, deceptive urgency or private birth details. Qualified language review is still required.</label><button disabled={busy||campaignExpired(row.expiresAt)||!reviewed.includes(row.id)} onClick={()=>void mutate(`/admin/notifications/campaigns/${row.id}/transition`,{action:"approve",revision:row.revision,contentPolicyReviewed:true})}>Approve content</button></>}{" "}
      {row.state==="APPROVED"&&<button disabled={busy||campaignExpired(row.expiresAt)||!schedule} onClick={()=>{const scheduledAt=isoDate(schedule);if(scheduledAt)void mutate(`/admin/notifications/campaigns/${row.id}/transition`,{action:"schedule",revision:row.revision,scheduledAt});}}>Schedule approved content</button>}{" "}
      {row.state!=="PAUSED"&&<button disabled={busy} onClick={()=>void mutate(`/admin/notifications/campaigns/${row.id}/transition`,{action:"pause",revision:row.revision})}>Pause</button>}
      {row.state==="SCHEDULED"&&<button disabled={busy} onClick={()=>void mutate(`/admin/notifications/campaigns/${row.id}/transition`,{action:"cancel",revision:row.revision})}>Cancel scheduled delivery</button>}
      {status?.id===row.id&&<div className={styles.history}><h4>Audit history</h4>{status.data.audit.length===0?<p>No audit events returned.</p>:<ol>{status.data.audit.map((event,index)=><li key={`${event.createdAt}:${event.action}:${index}`}><strong>{event.action}</strong> · <time dateTime={event.createdAt}>{notificationUtcDate(event.createdAt)}</time></li>)}</ol>}<h4>Delivery records</h4>{status.data.deliveries.length===0?<p>No delivery records returned.</p>:<ul>{status.data.deliveries.map(delivery=><li key={delivery.state}>{delivery.state}: {delivery.count}</li>)}</ul>}<p>Provider acceptance does not prove device display.</p></div>}
    </article>)}
  </section>;
}
