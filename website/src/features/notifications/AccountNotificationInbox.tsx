'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {inboxRequest,type Inbox} from './inbox-api';
import type {SubscriptionRole} from './subscription-api';
import s from './subscription-notifications.module.css';
export default function AccountNotificationInbox({role}:{role:SubscriptionRole}){
  const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const sequence=useRef(0),request=useRef<AbortController|null>(null);
  const load=useCallback(async(path='',mark=false)=>{const version=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');if(!mark)setData(null);
    try{if(mark)await inboxRequest(role,controller.signal,path,true);const value=await inboxRequest(role,controller.signal);if(version===sequence.current&&!controller.signal.aborted)setData(value);}
    catch(e){if(version===sequence.current&&!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:'Unable to load notifications.');}}
    finally{if(version===sequence.current&&!controller.signal.aborted)setBusy(false);}
  },[role]);
  useEffect(()=>{void load();const changed=()=>{setData(null);void load();};const focus=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('asp-auth-changed',changed);window.addEventListener('storage',changed);window.addEventListener('focus',focus);return()=>{sequence.current++;request.current?.abort();window.removeEventListener('asp-auth-changed',changed);window.removeEventListener('storage',changed);window.removeEventListener('focus',focus);};},[load]);
  return <section className={s.card} aria-labelledby="account-inbox-title"><h2 id="account-inbox-title">Account updates {data&&<span className={s.note}>· {data.unreadCount} unread</span>}</h2><p className={s.note}>Support, consultation, payment, subscription and account records. An inbox record is not proof of push delivery.</p><button type="button" disabled={busy} onClick={()=>void load()}>Refresh account updates</button>{busy&&<p role="status">Loading notifications…</p>}{error&&<p role="alert" className={s.error}>{error}</p>}{data&&!data.items.length&&<p>No account updates yet.</p>}{data?.items.map(item=><article className={s.reminder} key={item.id}><div><h3>{item.title}{!item.isRead&&<span className={s.unread}> Unread</span>}</h3><p>{item.body}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>{!item.isRead&&<button type="button" disabled={busy} onClick={()=>void load('/'+encodeURIComponent(item.id)+'/read',true)}>Mark read</button>}</article>)}</section>;
}
