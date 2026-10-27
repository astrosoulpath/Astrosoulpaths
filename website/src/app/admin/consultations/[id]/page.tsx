'use client';
import Link from 'next/link';
import {use, useEffect, useState} from 'react';
import {adminFetch} from '@/features/admin/auth/admin-session';
type Detail = {id:string;mode?:string;status?:string;createdAt?:string;startedAt?:string;endedAt?:string;purchasedMinutes?:number;earning?:{netAmount?:string|number;currency?:string;status?:string}};
export default function ConsultationDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=use(params);const [item,setItem]=useState<Detail|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setItem(null);
    void (async()=>{try{const response=await adminFetch('/admin/calls/'+encodeURIComponent(id),{signal:controller.signal});if(!response.ok)throw new Error('Unable to load consultation ('+response.status+').');const body=await response.json();if(!body.success || !body.data?.id)throw new Error('Consultation not found.');if(!controller.signal.aborted)setItem(body.data);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load consultation.');}finally{if(!controller.signal.aborted)setLoading(false);}})();return()=>controller.abort();
  },[id,retry]);
  return <main className="asp-admin-page"><div className="flex flex-wrap justify-between gap-4"><h1 className="text-3xl font-semibold">Consultation details</h1><Link href="/admin" className="asp-admin-button">Back to Dashboard</Link></div><Link href="/admin/consultations" className="my-4 inline-block underline">Back to consultations</Link>{loading?<p role="status">Loading consultation...</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(retry+1)}>Retry</button></div>:item&&<dl className="asp-admin-panel grid gap-4 p-6">{Object.entries({Reference:item.id,Type:item.mode,Status:item.status,'Created at':item.createdAt,'Started at':item.startedAt,'Ended at':item.endedAt,'Purchased minutes':item.purchasedMinutes,'Earnings status':item.earning?.status,'Recorded earnings':item.earning?.currency&&item.earning.netAmount!=null?item.earning.currency+' '+item.earning.netAmount:'Not recorded'}).map(([label,value])=><div key={label}><dt className="font-semibold">{label}</dt><dd>{value??'Not recorded'}</dd></div>)}</dl>}</main>;
}
