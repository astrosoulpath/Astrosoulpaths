"use client";
import { useRef, useState } from 'react';
import { array, customerSupportRequest, record, string, type SupportRecord } from './customer-support-api';
import { useSupportMutation, useSupportResource } from './support-hooks';
import { SupportState } from './SupportState';
import styles from './contact.module.css';
export function AiSupport({owner, online, config, onTicket}: {owner: string; online: boolean; config: SupportRecord; onTicket: (result: SupportRecord) => void}) {
  const [conversation, setConversation] = useState(''), [content, setContent] = useState(''), [consent, setConsent] = useState(false), [includeTranscript, setIncludeTranscript] = useState(false);
  const mutation = useSupportMutation(owner), conversations = useSupportResource('/support/assistant/conversations', owner);
  const detail = useSupportResource(conversation ? `/support/assistant/conversations/${encodeURIComponent(conversation)}` : null, owner);
  const key = useRef({content: '', conversation: '', id: ''});
  const closed = !!conversation && (!detail.data || record(detail.data.conversation).status !== 'ACTIVE');
  return <div className={styles.section}><SupportState resource={conversations}/><label>Existing conversation<select className={styles.input} value={conversation} onChange={event => {setConversation(event.target.value); setContent(''); setConsent(false);}}><option value="">Start / resume active conversation</option>{array(conversations.data?.conversations).map(item => <option key={string(item.id)} value={string(item.id)}>{string(item.status)} · {displayDate(item.createdAt)}</option>)}</select></label>
    <SupportState resource={detail}/>{array(record(detail.data?.conversation).messages).filter(item => ['CUSTOMER', 'ASSISTANT'].includes(string(item.senderType))).map(item => <div className={styles.message} key={string(item.id)}><small>{item.senderType === 'CUSTOMER' ? 'You' : 'AI Support'}</small>{string(item.content)}</div>)}
    <div className={styles.actions}>{array(config.categories).flatMap(category => array(category.questions).map(question => <button className={styles.button} key={string(question.id)} onClick={() => setContent(string(question.text))}>{string(question.text)}</button>))}</div>
    <form onSubmit={event => {event.preventDefault(); if (closed || mutation.busy || !consent || !content.trim()) return; if (key.current.content !== content.trim() || key.current.conversation !== conversation) key.current = {content: content.trim(), conversation, id: crypto.randomUUID()}; const draft = key.current.content, clientMessageId = key.current.id; void mutation.run(async signal => {
      let id = conversation; if (!id) {const started = await customerSupportRequest('/support/assistant/conversations', {method: 'POST', signal}); id = string(record(started.conversation).id); if (!id) throw Error('Conversation was not confirmed.');}
      const result = await customerSupportRequest(`/support/assistant/conversations/${encodeURIComponent(id)}/messages`, {method: 'POST', signal, body: JSON.stringify({content: draft, clientMessageId})}); return {...result, conversationId: id};
    }, result => {setConversation(string(result.conversationId)); setContent(current => current === draft ? '' : current); detail.reload(); conversations.reload();});}}>
      <label>Your support question<textarea className={styles.input} maxLength={5000} value={content} onChange={event => setContent(event.target.value)}/></label><label className={styles.fine}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> I agree to send this question to the configured AI provider. I will not share passwords, OTPs or unnecessary private data.</label>
      <button className={styles.button} disabled={!online || closed || !consent || !content.trim() || mutation.busy}>{mutation.busy ? 'Waiting for backend response…' : 'Send to AI Support'}</button>
    </form>
    {conversation && <div className={styles.notice}><label><input type="checkbox" checked={includeTranscript} onChange={event => setIncludeTranscript(event.target.checked)}/> Include this AI conversation when escalating to Human Support</label><button className={styles.button} disabled={!online || mutation.busy} onClick={() => {if (window.confirm('Create a Human Support ticket from this conversation?')) void mutation.run(signal => customerSupportRequest(`/support/assistant/conversations/${encodeURIComponent(conversation)}/escalate`, {method: 'POST', signal, body: JSON.stringify({includeConversation: includeTranscript})}), onTicket);}}>Request Human Support</button></div>}
    {mutation.error && <p role="alert" className={styles.notice}>{mutation.error}</p>}<p className={styles.fine}>AI cannot approve payments, issue refunds or change your account. No premium eligibility or real-time availability is inferred beyond the backend authorization.</p>
  </div>;
}
function displayDate(value: unknown) {const date = new Date(string(value)); return Number.isNaN(date.getTime()) ? 'Saved conversation' : date.toLocaleDateString();}
