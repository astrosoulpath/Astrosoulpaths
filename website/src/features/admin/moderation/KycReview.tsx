"use client";
import {useEffect,useRef,useState} from 'react';
import {adminFetch} from '../auth/admin-session';
import {privateKycLink,readKycReview,type ReviewDocument} from './kyc-review-contract';
export function KycReview({id}:{id:string}){
 const [loadedId,setLoadedId]=useState('');
 const [documents,setDocuments]=useState<ReviewDocument[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false),lifetime=useRef<AbortController|null>(null),expiry=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{setDocuments(null);setError('');setBusy(false);lock.current=false;return()=>{lifetime.current?.abort();if(expiry.current)clearTimeout(expiry.current);};},[id]);
 async function load(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setDocuments(null);const controller=new AbortController();lifetime.current=controller;
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);
  try{const response=await adminFetch('/admin/astrologers/'+encodeURIComponent(id)+'/kyc',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('Private document inspection is unavailable or not authorized.');const review=readKycReview(await response.json(),id);if(!controller.signal.aborted&&lifetime.current===controller){setLoadedId(id);setDocuments(review.documents);if(expiry.current)clearTimeout(expiry.current);expiry.current=setTimeout(()=>{setDocuments(null);setError('Private links expired. Inspect the documents again.');},review.expiresAt-Date.now());}}
  catch(e){if(lifetime.current===controller&&(timedOut||!controller.signal.aborted))setError(timedOut?'Private document request timed out. Retry inspection; no account was changed.':e instanceof Error?e.message:'Document inspection failed.');}finally{clearTimeout(timer);if(lifetime.current===controller){lock.current=false;if(timedOut||!controller.signal.aborted)setBusy(false);}}
 }
 return <section className="my-4 rounded-xl border p-4"><h3 className="font-semibold">Private KYC evidence</h3><p className="my-2 text-sm">Links expire within ten minutes. Do not share or persist them. Document upload alone is not identity verification.</p><button type="button" disabled={busy} className="asp-admin-back-btn" onClick={()=>void load()}>{busy?'Loading private links…':'Inspect submitted documents'}</button>{error&&<p role="alert">{error}</p>}{loadedId===id&&documents&&<ul className="my-3 space-y-2">{documents.length===0&&<li>No document references are available.</li>}{documents.map((document,index)=>{const href=privateKycLink(document.signedUrl);return <li key={index}>{href?<a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline">{document.type}: {document.name||'Document'}</a>:<span>{document.type}: private link unavailable; do not mark verified.</span>}</li>;})}</ul>}</section>;
}
