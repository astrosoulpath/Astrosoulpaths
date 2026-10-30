"use client";
import Link from 'next/link';
import {useRef,useState,type FormEvent} from 'react';
import {AuthShell} from './AuthShell';
import s from './auth-premium.module.css';
import {beginPublicAuthAttempt} from './public-auth';
/** Provider registration only: no client-created backend identity or approval flags. */
export function AstrologerEmailSignup(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 async function submit(event:FormEvent){event.preventDefault();if(lock.current)return;if(password!==confirmation){setError('Passwords must match.');return;}lock.current=true;setBusy(true);setError('');
  try{const [{firebaseAuth},{createUserWithEmailAndPassword,sendEmailVerification,signOut}]=await Promise.all([import('@/lib/firebaseClient'),import('firebase/auth')]);
   // Do not replace a different provider session to register another identity.
   const activeUid=()=>firebaseAuth.currentUser?.uid;
   await firebaseAuth.authStateReady();if(activeUid())throw Error('Use the existing signed-in account through Astrologer Login. Sign out normally before registering a different identity.');
   const current=beginPublicAuthAttempt();const credential=await createUserWithEmailAndPassword(firebaseAuth,email.trim().toLowerCase(),password);
   if(!current()||activeUid()!==credential.user.uid)throw Error('Account changed. Reopen the correct sign-in flow.');
   await sendEmailVerification(credential.user,{url:window.location.origin+'/astrologer/login'});
   if(!current()||activeUid()!==credential.user.uid)throw Error('Account changed. Use your existing sign-in method.');
   await signOut(firebaseAuth);setPassword('');setConfirmation('');setDone(true);
  }catch(e){setError(e instanceof Error&&!('code' in e)?e.message:'Registration was not confirmed. If this email already has an account, use its original sign-in provider. A new account is not linked automatically. If a verification email was sent, verify it and sign in normally.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <AuthShell eyebrow="Professional application" title="Create an email identity" description="Use Google or your original email provider for an existing account. A new identity does not grant professional approval.">{error&&<p role="alert" className={s.error}>{error}</p>}{done?<p role="status">Check your email to verify the address, then use Astrologer Email Login. Your canonical application is created only through the authorized backend workflow.</p>:<form className={s.form} onSubmit={submit}><label>Email<input required type="email" autoComplete="email" maxLength={254} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></label><label>Password<input required type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label><label>Confirm password<input required type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></label><button className={s.submit} disabled={busy}>{busy?'Registering…':'Register and verify email'}</button></form>}<div className={s.alternate}><Link href="/astrologer/login">Google or Email Astrologer Login</Link></div></AuthShell>;
}
