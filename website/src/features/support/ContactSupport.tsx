"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { array, CATEGORIES, record, string } from './customer-support-api';
import { identity, useSupportResource } from './support-hooks';
import { SupportState } from './SupportState';
import { CustomerWorkspace } from './CustomerWorkspace';
import styles from './contact.module.css';
export function SupportArt() {
  return <svg className={styles.art} viewBox="0 0 280 240" role="img" aria-label="Original celestial support assistant illustration"><defs><radialGradient id="support-orb"><stop stopColor="#785388"/><stop offset="1" stopColor="#272443"/></radialGradient><linearGradient id="support-gold"><stop stopColor="#fff1b9"/><stop offset="1" stopColor="#b9934b"/></linearGradient></defs><circle cx="140" cy="116" r="91" fill="none" stroke="#e0bc732a"/><ellipse cx="140" cy="124" rx="112" ry="42" fill="none" stroke="#bdaa7f" transform="rotate(-20 140 124)"/><circle cx="140" cy="116" r="72" fill="url(#support-orb)" stroke="url(#support-gold)" strokeWidth="2"/><path d="M102 99Q140 67 178 99V143Q140 168 102 143Z" fill="#fff8e9"/><path d="M119 145L113 162L139 151" fill="#fff8e9"/><path d="M126 112L140 95L154 112L140 132Z" fill="url(#support-gold)"/><path d="M140 90V136M120 112H160" stroke="#71508b" strokeWidth="2"/><g fill="#ead19a"><path d="M47 40L50 48L58 51L50 54L47 62L44 54L36 51L44 48Z"/><path d="M221 172L224 180L232 183L224 186L221 194L218 186L210 183L218 180Z"/><circle cx="224" cy="57" r="3"/><circle cx="63" cy="186" r="2"/></g></svg>;
}
export default function ContactSupport() {
  const help = useSupportResource('/support/public/help');
  const [account, setAccount] = useState({owner: '', revision: 0}), [online, setOnline] = useState(true);
  const [query, setQuery] = useState(''), [category, setCategory] = useState('GENERAL');
  useEffect(() => {
    let previous = '';
    const sync = () => {const next = identity(); setOnline(navigator.onLine); if (next !== previous) {previous = next; setAccount(current => ({owner: next, revision: current.revision + 1}));}};
    sync(); const timer = window.setInterval(sync, 1000);
    for (const event of ['storage', 'asp-auth-changed', 'focus', 'online', 'offline']) window.addEventListener(event, sync);
    return () => {clearInterval(timer); for (const event of ['storage', 'asp-auth-changed', 'focus', 'online', 'offline']) window.removeEventListener(event, sync);};
  }, []);
  const contact = help.data?.published === true ? record(help.data.contact) : {};
  const categories = Array.isArray(help.data?.categories) ? help.data.categories.filter((value): value is string => typeof value === 'string' && Object.hasOwn(CATEGORIES, value)) : [];
  const faqs = (help.data?.published === true ? array(help.data.faqs) : []).filter(faq => `${string(faq.question)} ${string(faq.answer)}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>Astro Soul Path · Contact & support</span><h1>How Can We Help You?</h1><p>A thoughtful place for account help, consultation questions and support that stays connected to your existing Astro Soul Path account.</p><div className={styles.actions}><a className={styles.button} href="#support-workspace">Contact support</a><a className={styles.button} href="#support-faq">Browse FAQs</a></div></div><SupportArt/></header>
    {!online && <p role="status" className={styles.notice}>You are offline. Your unsent form stays on this page; reconnect before sending.</p>}
    <section className={styles.section} aria-label="Support categories"><h2>Find the right help</h2><SupportState resource={help}/><div className={styles.grid}>{categories.map(value => <button type="button" key={value} className={`${styles.card} ${styles.category}`} onClick={() => {setCategory(value); document.getElementById('support-workspace')?.scrollIntoView({block: 'start'});}}><span aria-hidden="true">✦</span>{CATEGORIES[value]}</button>)}</div>
      <p className={styles.fine}>Kundli, Horoscope, subscription and Soul Bazaar questions can be described under the supported general/account/payment category. No separate service queue is implied.</p>
    </section>
    <section id="support-faq" className={styles.section}><h2>Frequently asked questions</h2><label htmlFor="support-faq-search">Search published help</label><input id="support-faq-search" className={styles.input} type="search" maxLength={160} placeholder="Search your question" value={query} onChange={event => setQuery(event.target.value)}/>
      {faqs.map(faq => <details className={styles.faq} key={string(faq.id)}><summary>{string(faq.question)}</summary><p>{string(faq.answer)}</p></details>)}
      {!help.busy && !faqs.length && <p className={styles.notice}>{query ? 'No published answers match your search.' : 'Public FAQ answers have not been published. Sign in for account-specific help.'}</p>}
    </section>
    <section id="support-workspace" className={styles.section}><h2>Your support workspace</h2>{account.owner ? <CustomerWorkspace key={account.revision} owner={account.owner} category={category} online={online}/> : <div className={styles.card}><h3 className="text-xl font-semibold">Private help starts with a Customer sign-in</h3><p>Your tickets and conversations are visible only to your authorized account. Public information remains available without signing in.</p><Link className={styles.button} href="/login">Sign in to Customer support</Link></div>}</section>
    <section className={styles.section}><h2>Published contact information</h2><div className={styles.grid}><div className={styles.card}><h3>Email</h3>{string(contact.email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string(contact.email)) ? <a href={`mailto:${string(contact.email)}`}>{string(contact.email)}</a> : <p>Verified support email has not been published.</p>}</div><div className={styles.card}><h3>Support hours</h3><p>{string(contact.hours) || 'No verified support hours are published.'}</p></div><div className={styles.card}><h3>Response guidance</h3><p>{string(contact.responseTime) || 'No response-time promise is published. Track your request in ticket history.'}</p></div></div></section>
  </div></main>;
}
