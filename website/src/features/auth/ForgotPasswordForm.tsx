"use client";
import Link from 'next/link';
import {useRef,useState,type FormEvent} from 'react';
import {AuthShell} from './AuthShell';
import {requestPasswordRecovery} from './password-recovery';
import s from './auth-premium.module.css';
export function ForgotPasswordForm(){
 const [email,setEmail]=useState(''),[provider,setProvider]=useState<'firebase'|'legacy'>('firebase');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const lock=useRef(false),lastSent=useRef(0);
 async function submit(event:FormEvent){event.preventDefault();if(lock.current)return;
  if(Date.now()-lastSent.current<60000){setError('Wait one minute before requesting another link.');return;}
  lock.current=true;setBusy(true);setError('');setMessage('');
  try{await requestPasswordRecovery(email,provider);lastSent.current=Date.now();setMessage('If this account supports password recovery, check its email for the next steps. Google-only accounts should use Continue with Google.');}
  catch(e){setError(e instanceof Error?e.message:'Recovery is unavailable. Try later.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <AuthShell eyebrow="Account recovery" title="Reset your password" description="Use the provider where you created your email account. Existing accounts are never merged.">
 {error&&<p className={s.error} role="alert">{error}</p>}{message&&<p className={s.success} role="status">{message}</p>}
 <form className={s.form} onSubmit={submit}>
 <label>Email address<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
 <label>Original email account<select value={provider} onChange={e=>setProvider(e.target.value as 'firebase'|'legacy')} disabled={busy}><option value="firebase">App / Firebase email account</option><option value="legacy">Existing website email account</option></select></label>
 <button className={s.submit} disabled={busy}>{busy?'Requesting…':'Send recovery link'}</button>
 </form><div className={s.alternate}><Link href="/login?method=email">Customer Login</Link><Link href="/astrologer/login?method=email">Astrologer Login</Link></div>
 </AuthShell>;
}