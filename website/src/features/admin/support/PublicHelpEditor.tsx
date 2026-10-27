"use client";
import type { CatalogueConfig } from './support-catalogue-contract';
type Help = NonNullable<CatalogueConfig['publicHelp']>;
export function PublicHelpEditor({value, onChange}: {value?: Help; onChange: (value: Help) => void}) {
  const help: Help = value ?? {published: false, email: '', hours: '', responseTime: '', faqs: []};
  function edit(change: (draft: Help) => void) {const draft = structuredClone(help); change(draft); onChange(draft);}
  return <section className="rounded-xl border border-[#E4D3AF] p-4" aria-label="Public Contact page configuration"><h3 className="text-lg font-semibold">Public Contact page & FAQs</h3>
    <p className="my-2 text-sm">Separate from private AI knowledge. Publish only verified contact information and approved public answers. Existing audited Save and revision checks apply.</p>
    <label className="flex gap-2"><input type="checkbox" checked={help.published} onChange={event => edit(draft => {draft.published = event.target.checked;})}/>Publish public support information</label>
    {(['email', 'hours', 'responseTime'] as const).map(field => <label className="my-3 block" key={field}>{field === 'email' ? 'Verified support email' : field === 'hours' ? 'Published hours and timezone' : 'Approved response guidance (no invented SLA)'}<input type={field === 'email' ? 'email' : 'text'} className="asp-admin-input mt-1 w-full" value={help[field]} maxLength={field === 'email' ? 254 : field === 'hours' ? 200 : 300} onChange={event => edit(draft => {draft[field] = event.target.value;})}/></label>)}
    {help.faqs.map((faq, index) => <div key={faq.id} className="my-3 rounded-lg border p-3"><label className="block">Public FAQ question<input className="asp-admin-input w-full" maxLength={200} value={faq.question} onChange={event => edit(draft => {draft.faqs[index].question = event.target.value;})}/></label><label className="block">Approved public answer<textarea className="asp-admin-input w-full" maxLength={2000} value={faq.answer} onChange={event => edit(draft => {draft.faqs[index].answer = event.target.value;})}/></label>
      <label>Category<select className="asp-admin-input" value={faq.category} onChange={event => edit(draft => {draft.faqs[index].category = event.target.value;})}>{['GENERAL', 'CONSULTATION', 'PAYMENT', 'WALLET', 'ACCOUNT', 'ASTROLOGER', 'TECHNICAL', 'OTHER'].map(category => <option key={category}>{category}</option>)}</select></label>
      <label className="ml-3"><input type="checkbox" checked={faq.enabled} onChange={event => edit(draft => {draft.faqs[index].enabled = event.target.checked;})}/>Publish this answer</label>
      <button type="button" className="ml-3 underline" onClick={() => edit(draft => {draft.faqs.splice(index, 1);})}>Remove FAQ from draft</button>
    </div>)}
    <button type="button" className="asp-admin-outline-btn px-3 py-2" disabled={help.faqs.length >= 40} onClick={() => edit(draft => {draft.faqs.push({id: `faq-${crypto.randomUUID()}`, question: '', answer: '', category: 'GENERAL', enabled: false});})}>Add unpublished FAQ</button>
  </section>;
}
