"use client";
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {AuthShell} from './AuthShell';
import {finishPasswordRecovery} from './password-recovery';
import s from './auth-premium.module.css';
export function ResetPasswordForm(){
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false);
  const code=useRef(''),provider=useRef<'firebase'|'legacy'>('firebase'),lock=useRef(false),initialized=useRef(false);
  useEffect(()=>{if(initialized.current)return;initialized.current=true;const query=new URLSearchParams(window.location.search);provider.current=query.get('provider')==='legacy'?'legacy':'firebase';
    code.current=provider.current==='legacy'?query.get('code')||'':query.get('mode')==='resetPassword'?query.get('oobCode')||'':'';
    window.history.replaceState(null,'','/reset-password');setReady(!!code.current);
    if(!code.current)setError('Open a valid password recovery link from your email.');
  },[]);
  async function submit(event:FormEvent){event.preventDefault();if(lock.current)return;
    if(password!==confirmation){setError('Passwords must match.');return;}
    lock.current=true;setBusy(true);setError('');
    try{await finishPasswordRecovery(provider.current,code.current,password);setDone(true);setPassword('');setConfirmation('');code.current='';}
    catch{setError('Recovery could not be confirmed. Request a fresh link; do not assume your password changed.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <AuthShell eyebrow="Secure account recovery" title="Choose a new password" description="This does not merge accounts or grant professional approval.">
    {error&&<p role="alert" className={s.error}>{error}</p>}{done?<p role="status" className={s.success}>Password updated. Sign in normally with your existing account.</p>:
      <form className={s.form} onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||!ready}/></label><label>Confirm password<input type="password" autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy||!ready}/></label><button className={s.submit} disabled={busy||!ready}>{busy?'Updating…':'Update password'}</button></form>}
    <div className={s.alternate}><Link href="/forgot-password">Request a new link</Link><Link href="/login?method=email">Return to sign in</Link></div>
  </AuthShell>;
}
