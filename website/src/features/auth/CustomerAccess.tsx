"use client";
import Link from 'next/link';
import type {CustomerAuthState} from './use-customer-session';
import s from '../customer-workspace/workspace.module.css';
export function CustomerAccess({auth,returnTo,retry}:{auth:CustomerAuthState;returnTo:string;retry:()=>void}){
 if(auth.status==='loading')return <p role="status" className={s.notice}>Verifying Customer access…</p>;
 if(auth.status==='authenticated')return <p className={s.notice}>Customer account · <strong>{auth.customer?.name}</strong></p>;
 return <section className={s.notice} aria-live="polite"><p>{auth.message||'Sign in as a Customer to load your saved records.'}</p><div className={s.actions}><Link className={s.button} href={'/login?redirect='+encodeURIComponent(returnTo)}>{auth.status==='recovery'?'Reconnect Customer account':auth.status==='wrong-portal'?'Choose Customer access':auth.status==='error'?'Open secure Customer sign-in':'Customer sign-in'}</Link><button type="button" className={s.secondary} onClick={retry}>Retry verification</button></div></section>;
}
