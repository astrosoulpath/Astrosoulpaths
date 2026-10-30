"use client";
import {useRef,useState} from 'react';
import {applicationRequest,uploadApplicationDocument,type ApplicationStatus} from './application-api';
const labels:Record<string,string>={bio:'Professional biography',languages:'Spoken languages (comma separated)',identityProof:'Identity document',certificates:'Qualification document',experienceProofs:'Experience document'};
export function ApplicationCorrections({application,onSaved}:{application:ApplicationStatus;onSaved:()=>void}){
  const [values,setValues]=useState<Record<string,unknown>>({}),[country,setCountry]=useState(application.applicationCountryCode??''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
  const lock=useRef(false);
  const fields=application.requestedFields;
  if(!application.correctionsAvailable||!fields.length||fields.some(field=>!labels[field]))return <p>Correction submission is not available. Contact support.</p>;
  async function upload(field:string,file?:File){
    if(!file||lock.current)return;lock.current=true;setBusy(true);setError('');
    try{const type=field==='identityProof'?'identity':field==='certificates'?'certificate':'experience';const document=await uploadApplicationDocument(file,type,{accepted:consent,countryCode:country});setValues(current=>({...current,[field]:field==='identityProof'?document:[document]}));}
    catch(e){setError(e instanceof Error?e.message:'Upload not confirmed.');}finally{lock.current=false;setBusy(false);}
  }
  async function save(){
    if(lock.current||uncertain)return;
    if(!consent||!/^[A-Z]{2}$/.test(country)||fields.some(field=>values[field]===undefined)){setError('Complete every requested field and consent before submitting.');return;}
    lock.current=true;setBusy(true);setError('');
    try{await applicationRequest('/astrologer/application/corrections',{method:'PATCH',body:JSON.stringify({requestId:crypto.randomUUID(),expectedVersion:application.applicationVersion,updates:values,consentAccepted:true,countryCode:country})});onSaved();}
    catch(e){setUncertain(true);setError((e instanceof Error?e.message:'Submission not confirmed.')+' Refresh server status before another submission.');}finally{lock.current=false;setBusy(false);}
  }
  return <form className="mt-6 space-y-4" onSubmit={event=>{event.preventDefault();void save();}}>
    <p className="whitespace-pre-wrap">{application.correctionReason}</p>
    <label className="block">Country code<input aria-label="Application country code" className="block w-full rounded-lg border p-3" value={country} maxLength={2} disabled={busy||!!application.applicationCountryCode} onChange={event=>setCountry(event.target.value.toUpperCase())}/></label>
    <label className="flex gap-2"><input type="checkbox" checked={consent} disabled={busy||uncertain} onChange={event=>setConsent(event.target.checked)}/>I consent to private review of these corrections. Upload only documents I am authorized to provide.</label>
    <fieldset disabled={busy||uncertain} className="space-y-4">{fields.map(field=><label key={field} className="block">{labels[field]}{field==='bio'||field==='languages'?<textarea required className="block w-full rounded-lg border p-3" maxLength={field==='bio'?4000:1600} onChange={event=>setValues(current=>({...current,[field]:field==='languages'?event.target.value.split(',').map(value=>value.trim()).filter(Boolean):event.target.value}))}/>:<><input className="block max-w-full" type="file" accept="application/pdf,image/png,image/jpeg" disabled={!consent||!/^[A-Z]{2}$/.test(country)} onChange={event=>void upload(field,event.target.files?.[0])}/>{values[field]!==undefined&&<span role="status">Private upload confirmed</span>}</>}</label>)}</fieldset>
    {error&&<p role="alert">{error}</p>}<button disabled={busy||uncertain} className="rounded-xl bg-[#7548CF] px-5 py-3 text-white">{busy?'Confirming…':'Submit requested corrections'}</button>
  </form>;
}
