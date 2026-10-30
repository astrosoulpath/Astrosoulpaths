"use client";
import {useEffect,useRef,useState} from 'react';
import {adminFetch} from '../auth/admin-session';
type ReviewDocument={type?:string;name?:string;signedUrl?:string|null;error?:string};
function privateLink(value:unknown):string|null{try{const url=new URL(String(value));return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function KycReview({id}:{id:string}){
 const [documents,setDocuments]=useState<ReviewDocument[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false),lifetime=useRef<AbortController|null>(null);
 useEffect(()=>()=>{lifetime.current?.abort();},[]);
 async function load(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setDocuments(null);const controller=new AbortController();lifetime.current=controller;
  try{const response=await adminFetch('/admin/astrologers/'+encodeURIComponent(id)+'/kyc',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('Private document inspection is unavailable or not authorized.');const value=await response.json(),data=value.data;if(!value.success||!data)throw Error('KYC response could not be verified.');if(!controller.signal.aborted)setDocuments([data.identityProof,...(data.certificates??[]),...(data.experienceProofs??[])].filter(Boolean));}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Document inspection failed.');}finally{lock.current=false;if(!controller.signal.aborted)setBusy(false);}
 }
 return <section className="my-4 rounded-xl border p-4"><h3 className="font-semibold">Private KYC evidence</h3><p className="my-2 text-sm">Links expire after ten minutes. Do not share or persist them. Document upload alone is not identity verification.</p><button type="button" disabled={busy} className="asp-admin-back-btn" onClick={()=>void load()}>{busy?'Loading private links…':'Inspect submitted documents'}</button>{error&&<p role="alert">{error}</p>}{documents&&<ul className="my-3 space-y-2">{documents.length===0&&<li>No document references are available.</li>}{documents.map((document,index)=>{const href=privateLink(document.signedUrl);return <li key={index}>{href?<a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline">{document.type}: {document.name||'Document'}</a>:<span>{document.type}: private link unavailable; do not mark verified.</span>}</li>;})}</ul>}</section>;
}
