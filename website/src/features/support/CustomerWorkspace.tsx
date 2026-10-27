"use client";
import { useEffect, useState } from 'react';
import { array, CATEGORIES, customerSupportRequest, record, STATUSES, string, type SupportRecord } from './customer-support-api';
import { useSupportMutation, useSupportResource } from './support-hooks';
import { SupportState } from './SupportState';
import { TicketDetail } from './TicketDetail';
import { AiSupport } from './AiSupport';
import styles from './contact.module.css';
export function CustomerWorkspace({owner, category, online}: {owner: string; category: string; online: boolean}) {
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [status, setStatus] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null), [created, setCreated] = useState(''), [uncertain, setUncertain] = useState(false);
  const [subject, setSubject] = useState(''), [description, setDescription] = useState(''), [selectedCategory, setSelectedCategory] = useState(category);
  const [aiOpen, setAiOpen] = useState(false);
  const mutation = useSupportMutation(owner);
  const list = useSupportResource(`/support/tickets?${new URLSearchParams({page: String(page), limit: '10', search, ...(status ? {status} : {})})}`, owner);
  const config = useSupportResource('/support/assistant/config', owner), health = useSupportResource('/support/assistant/health', owner);
  useEffect(() => {setSelectedCategory(category);}, [category]);
  const refreshList = list.reload;
  useEffect(() => {const timer = window.setInterval(() => {if (document.visibilityState === 'visible') refreshList();}, 30000); return () => clearInterval(timer);}, [refreshList]);
  function createdTicket(result: SupportRecord) {const ticket = record(result.ticket); if (!string(ticket.id)) {setUncertain(true); return;} setTicketId(string(ticket.id)); setCreated(string(ticket.ticketNumber)); setSubject(''); setDescription(''); list.reload();}
  return <>
    <div className={styles.two}><section className={styles.card}><h3 className="text-xl font-semibold">Send a support request</h3><p className={styles.fine}>Do not include passwords, OTPs, full payment-card details or unnecessary birth/identity documents. Attach optional evidence after your ticket is saved.</p>
      <form className={styles.form} onSubmit={event => {event.preventDefault(); if (!uncertain && subject.trim().length >= 3 && description.trim()) void mutation.run(signal => customerSupportRequest('/support/tickets', {method: 'POST', signal, body: JSON.stringify({subject: subject.trim(), description: description.trim(), category: selectedCategory})}), createdTicket, () => setUncertain(true));}}>
        <label>Category<select className={styles.input} value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)}>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Subject<input className={styles.input} required minLength={3} maxLength={160} value={subject} onChange={event => setSubject(event.target.value)}/></label>
        <label>Describe the issue<textarea className={styles.input} required rows={5} maxLength={4000} value={description} onChange={event => setDescription(event.target.value)}/></label>
        <button className={styles.button} disabled={!online || mutation.busy || uncertain || subject.trim().length < 3 || !description.trim()}>{mutation.busy ? 'Saving request…' : 'Create support ticket'}</button>
      </form>
      {mutation.error && <p role="alert" className={styles.notice}>{mutation.error}</p>}{created && <p role="status" className={styles.notice}>Ticket saved: {created}</p>}
      {uncertain && <div className={styles.notice}><p>Submission was not confirmed. Review and refresh ticket history before another attempt.</p><button className={styles.button} onClick={list.reload}>Refresh ticket history</button><label><input type="checkbox" onChange={event => {if (event.target.checked) setUncertain(false);}}/> I checked history and still need to submit this request.</label></div>}
    </section>
    <section className={styles.card}><h3 className="text-xl font-semibold">Ticket history & status</h3><label>Search your tickets<input type="search" className={styles.input} value={search} maxLength={160} onChange={event => {setSearch(event.target.value); setPage(1);}}/></label><label>Status<select className={styles.input} value={status} onChange={event => {setStatus(event.target.value); setPage(1);}}><option value="">All statuses</option>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></label><SupportState resource={list}/>
      {array(list.data?.tickets).map(ticket => <button className={styles.ticket} key={string(ticket.id)} onClick={() => setTicketId(string(ticket.id))}><strong>{string(ticket.subject)}</strong><br/>{string(ticket.ticketNumber)} <span className={styles.badge}>{string(ticket.status)}</span></button>)}
      {list.data && !array(list.data.tickets).length && <p>No tickets match these filters.</p>}
      <div className={styles.actions}><button className={styles.button} disabled={page <= 1 || list.busy} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button className={styles.button} disabled={list.busy || !list.data || page * 10 >= Number(record(list.data.pagination).total || 0)} onClick={() => setPage(value => value + 1)}>Next</button><button className={styles.button} disabled={list.busy} onClick={list.reload}>Refresh tickets</button></div>
    </section></div>
    {ticketId && <TicketDetail key={ticketId} owner={owner} id={ticketId} online={online} onRefresh={list.reload}/>}
    <section className={`${styles.section} ${styles.card}`}><h3 className="text-xl font-semibold">AI Support assistant</h3><SupportState resource={config}/><SupportState resource={health}/>
      {config.data?.visible === true && record(health.data?.provider).available === true ? <><p>{string(config.data.welcome)}</p><button className={styles.button} onClick={() => setAiOpen(value => !value)}>{aiOpen ? 'Close AI panel' : 'Open AI support'}</button>{aiOpen && <AiSupport owner={owner} online={online} config={config.data} onTicket={createdTicket}/>}</> : <p className={styles.fine}>AI availability is not confirmed. Existing Human Support remains available above; no assistant response is simulated.</p>}
    </section>
  </>;
}
