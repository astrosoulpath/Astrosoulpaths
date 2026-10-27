"use client";
import { useEffect, useRef, useState } from 'react';
import { array, attachmentLink, customerSupportRequest, record, string, supportAttachment } from './customer-support-api';
import { useSupportMutation, useSupportResource } from './support-hooks';
import { SupportState } from './SupportState';
import styles from './contact.module.css';
export function TicketDetail({owner, id, online, onRefresh}: {owner: string; id: string; online: boolean; onRefresh: () => void}) {
  const detail = useSupportResource(`/support/tickets/${encodeURIComponent(id)}`, owner), mutation = useSupportMutation(owner);
  const [reply, setReply] = useState(''), [file, setFile] = useState<File | null>(null), [message, setMessage] = useState('');
  const messageKey = useRef({content: '', key: ''});
  const ticket = record(detail.data?.ticket), refresh = detail.reload;
  useEffect(() => {const timer = window.setInterval(() => {if (document.visibilityState === 'visible') refresh();}, 30000); return () => clearInterval(timer);}, [refresh]);
  const closed = ticket.status === 'CLOSED';
  return <section className={`${styles.card} ${styles.section}`} aria-label="Selected support ticket"><h3 className="text-xl font-semibold">{string(ticket.ticketNumber) || 'Ticket details'}</h3><SupportState resource={detail}/>{detail.data && <>
    <p>{string(ticket.subject)}</p><span className={styles.badge}>{string(ticket.status)}</span><p className={styles.fine}>{string(ticket.description)}</p>
    {array(ticket.messages).filter(item => ['CUSTOMER', 'ADMIN', 'SYSTEM'].includes(string(item.senderType))).map(item => <div className={styles.message} key={string(item.id)}><small>{item.senderType === 'ADMIN' ? 'Support team' : item.senderType === 'CUSTOMER' ? 'You' : 'Status update'}</small>{string(item.content)}</div>)}
    {array(ticket.attachments).map(item => {const url = attachmentLink(item.url); return <p key={string(item.id)}>{url ? <a className={styles.button} href={url} target="_blank" rel="noopener noreferrer" download>{string(item.originalFileName) || 'Download attachment'}</a> : 'Attachment link unavailable. Refresh ticket details.'}</p>;})}
    <form onSubmit={event => {event.preventDefault(); const content = reply.trim(); if (!content || closed) return; if (messageKey.current.content !== content) messageKey.current = {content, key: crypto.randomUUID()}; void mutation.run(signal => customerSupportRequest(`/support/tickets/${encodeURIComponent(id)}/messages`, {method: 'POST', signal, body: JSON.stringify({content, clientMessageId: messageKey.current.key})}), () => {setReply(''); setMessage('Reply saved.'); detail.reload(); onRefresh();});}}>
      <label>Reply<textarea className={styles.input} value={reply} maxLength={5000} disabled={closed} onChange={event => setReply(event.target.value)}/></label><button className={styles.button} disabled={!online || closed || mutation.busy || !reply.trim()}>Send reply</button>
    </form>
    <label className={styles.fine}>Optional evidence (up to 10 MB)<input className={styles.input} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt" disabled={closed || mutation.busy} onChange={event => {setFile(event.target.files?.[0] || null); setMessage('');}}/></label>
    <button className={styles.button} disabled={!online || closed || mutation.busy || !file} onClick={() => {if (!file || closed) return; void mutation.run(signal => customerSupportRequest(`/support/tickets/${encodeURIComponent(id)}/attachments`, {method: 'POST', signal, body: supportAttachment(file)}), () => {setFile(null); setMessage('Attachment saved.'); detail.reload();});}}>Upload evidence</button>
    {closed && <p className={styles.notice}>This ticket is closed. Replies and uploads are disabled.</p>}
  </>}{mutation.error && <p role="alert" className={styles.notice}>{mutation.error}</p>}{message && <p role="status">{message}</p>}<button className={styles.button} onClick={detail.reload} disabled={detail.busy}>Refresh ticket details</button></section>;
}
