"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {readApplication,type ApplicationStatus} from './application-api';
import {ApplicationCorrections} from './ApplicationCorrections';
const titles:Record<ApplicationStatus['status'],string>={PROFILE_COMPLETION:'Complete your application',PENDING_REVIEW:'Application under review',APPROVED:'Application approved',REJECTED:'Application not approved',NEEDS_CHANGES:'Corrections requested',SUSPENDED:'Professional access unavailable'};
export function ApplicationTracking(){
  const [data,setData]=useState<ApplicationStatus|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{const controller=new AbortController();setData(null);setError('');
    let sequence=0;
    async function load(){const request=++sequence;try{const next=await readApplication(controller.signal);if(!controller.signal.aborted&&request===sequence)setData(next);}catch(e){if(!controller.signal.aborted&&request===sequence){setData(null);setError(e instanceof Error?e.message:'Status unavailable.');}}}
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);
    const changed=()=>{controller.abort();setData(null);setError('Account changed. Sign in again.');};window.addEventListener('asp-auth-changed',changed);window.addEventListener('storage',changed);
    return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener('asp-auth-changed',changed);window.removeEventListener('storage',changed);};
  },[reload]);
  return <main className="min-h-screen bg-[#FFF9F1] px-5 py-16 text-[#17213B]"><section className="mx-auto max-w-2xl rounded-3xl border border-[#E8E2F0] bg-white p-7 shadow-sm"><p className="text-sm font-semibold text-[#7548CF]">Astro Soul Path · Application status</p><h1 className="my-4 text-3xl font-bold">{data?titles[data.status]:'Checking application status'}</h1>
    {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading your authorized server status…</p>}
    {data&&<><p>Google/email login and document upload do not grant professional approval. Only the backend determines your current eligibility.</p>
      {data.status==='PENDING_REVIEW'&&<p className="mt-4">Your existing application is awaiting an authorized review. No completion time is promised.</p>}
      {data.status==='REJECTED'&&<p className="mt-4">Contact support for the permitted next steps. Do not create a second account or application.</p>}
      {data.status==='NEEDS_CHANGES'&&<p className="mt-4">Only explicitly requested information may be changed. Contact support if the correction workflow is not available for your application.</p>}
      {data.status==='NEEDS_CHANGES'&&<ApplicationCorrections key={data.applicationVersion} application={data} onSaved={()=>setReload(n=>n+1)}/>}
      {data.status==='SUSPENDED'&&<p className="mt-4">Professional dashboard access is denied. Contact support; re-registering does not restore access.</p>}
      {data.status==='APPROVED'&&<Link className="my-4 inline-block underline" href="/astrologer/login">Refresh authorization through Astrologer Login</Link>}
      {data.status==='PROFILE_COMPLETION'&&<Link className="my-4 inline-block underline" href="/astrologer/register">Complete the existing application</Link>}
    </>}
    <div className="mt-6 flex flex-wrap gap-4"><button className="rounded-xl bg-[#7548CF] px-5 py-3 text-white" onClick={()=>setReload(n=>n+1)}>Refresh status</button><Link className="py-3 underline" href="/astrologer/login">Astrologer Login</Link><Link className="py-3 underline" href="/contact">Contact support</Link></div>
  </section></main>;
}
