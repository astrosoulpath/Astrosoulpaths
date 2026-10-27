"use client";
import { useEffect, useRef, useState } from "react";
import { adminFetch } from "./auth/admin-session";

type Detail = {
  id:string; providerMode:string;status:string;currency:string;amount:string|number;
  canReconcile:boolean;refundExecution:{enabled:boolean;reason:string};
  settlement:{status:string;reason:string};
  audit:Array<{id:string;action:string;state:string;reason:string;createdAt:string}>;
};
export function PaymentOperations({id}:{id:string}) {
  const [data,setData]=useState<Detail|null>(null),[open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[reason,setReason]=useState("");
  const generation=useRef(0),inFlight=useRef(false);
  useEffect(()=>()=>{generation.current++;},[id]);
  async function load() {
    const version=generation.current;setBusy(true);setError("");
    try {
      const response=await adminFetch(`/admin/payment-operations/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(15000)});
      const body=await response.json();
      if(!response.ok||!body.success) throw Error("Payment details unavailable. Retry or sign in again.");
      if(version===generation.current)setData(body.data);
    } catch(e) {if(version===generation.current)setError(e instanceof Error?e.message:"Payment details unavailable.");}
    finally {if(version===generation.current)setBusy(false);}
  }
  async function reconcile() {
    if(inFlight.current||!data?.canReconcile||reason.trim().length<10)return;
    inFlight.current=true;const version=generation.current;setBusy(true);setError("");
    try {
      const response=await adminFetch(`/admin/payment-operations/${encodeURIComponent(id)}/reconcile`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({reason:reason.trim(),requestKey:crypto.randomUUID()}),signal:AbortSignal.timeout(30000),
      });
      if(!response.ok)throw Error("Reconciliation was not confirmed. Reload audit history before retrying.");
      if(version===generation.current)await load();
    } catch(e) {if(version===generation.current)setError(e instanceof Error?e.message:"Reconciliation unavailable.");}
    finally {inFlight.current=false;if(version===generation.current)setBusy(false);}
  }
  return <div className="mt-3 text-sm">
    <button type="button" className="font-semibold underline" disabled={busy} aria-expanded={open}
      onClick={()=>{setOpen(!open);if(!open)void load();}}>Payment details &amp; reconciliation</button>
    {open&&<section aria-label="Payment operations" className="mt-2 max-w-lg space-y-2 rounded-lg border p-3">
      {busy&&<p role="status">Loading verified payment state…</p>}
      {error&&<p role="alert">{error}</p>}
      {data&&<>
        <p><strong>{data.providerMode==="TEST"?"TEST MODE":data.providerMode==="LIVE"?"LIVE RECORD":"HISTORICAL MODE UNKNOWN"}</strong> · {data.status}</p>
        <p>{data.refundExecution.reason}</p>
        <p>Bank settlement: {data.settlement.status}. {data.settlement.reason}</p>
        <label className="block">Reconciliation reason
          <input className="block w-full rounded border p-2" value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/>
        </label>
        <button type="button" disabled={busy||!data.canReconcile||reason.trim().length<10} onClick={()=>void reconcile()}>Reconcile TEST payment</button>
        {!data.canReconcile&&<p>A TEST-tagged order and verified local test-operation configuration are required. No LIVE or unknown-mode action is permitted.</p>}
        <details><summary>Audit and technical details</summary>
          {!data.audit.length?<p>No recorded operations.</p>:data.audit.map(row=><p key={row.id}>{row.createdAt} · {row.action} · {row.state} · {row.reason}</p>)}
        </details>
      </>}
      <button type="button" disabled={busy} onClick={()=>void load()}>Reload details</button>
    </section>}
  </div>;
}
