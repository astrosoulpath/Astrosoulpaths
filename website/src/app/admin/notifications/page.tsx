"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/features/admin/auth/admin-session";
import CampaignManager from "./CampaignManager";
import PolicyManager from "./PolicyManager";
type Catalog = {version:string; automaticDeliveryEnabled:boolean;policyStatus:string;categories:{id:string;label:string;template:string;automaticStatus:string;personalized:boolean}[];missingCapabilities:string[]};
export default function NotificationCatalogPage() {
  const [catalog,setCatalog] = useState<Catalog|null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{let active=true; void adminFetch('/admin/notifications/catalog').then(async response=>{
    if(!response.ok) throw new Error();
    const body=await response.json();
    if(body.success!==true || !Array.isArray(body.data?.categories)) throw new Error();
    if(active)setCatalog(body.data);
  }).catch(()=>{if(active)setError('Notification catalogue could not be loaded.');}); return()=>{active=false;};},[]);
  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-slate-900 sm:p-6"><header className="space-y-3 border-b border-amber-200/70 pb-6"><p className="text-sm font-semibold uppercase tracking-widest text-amber-800">Astro Soul Path · Notification studio</p><h1 className="text-3xl font-semibold">Notification catalogue</h1>
    <p className="max-w-3xl text-base leading-relaxed text-slate-600">Prepare editorial drafts, review category controls and inspect delivery records. Saving a draft does not activate delivery. Editorial templates are not personalized chart findings.</p></header>
    {error ? <p role="alert">{error}</p> : !catalog ? <p role="status">Loading…</p> : <>
      <p>Policy: {catalog.policyStatus}</p>
      <CampaignManager categories={catalog.categories}/>
      <PolicyManager/>
      <details className="space-y-4 rounded-xl border border-amber-200/70 bg-white p-5"><summary className="cursor-pointer text-xl font-semibold">Category reference and activation prerequisites</summary><div className="mt-4 grid gap-4 md:grid-cols-2">{catalog.categories.map(category=><section key={category.id} className="min-w-0 space-y-2 break-words rounded-xl border p-4"><h2 className="text-xl">{category.label}</h2><p>{category.template}</p><p className="text-sm">{category.automaticStatus}</p><p>Source: Admin editorial preview</p></section>)}</div>
      <h2 className="mt-5 text-xl">Required before activation</h2><ul className="list-inside list-disc">{catalog.missingCapabilities.map(item=><li key={item}>{item}</li>)}</ul></details>
    </>}
  </main>;
}
