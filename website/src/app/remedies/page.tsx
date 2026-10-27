import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import RemedyGuidance from "@/features/remedies/RemedyGuidance";
import CustomerRemedies from "@/features/remedies/CustomerRemedies";
import s from "@/features/remedies/remedies.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vedic Remedies & Thoughtful Guidance | Astro Soul Path", description: "Explore traditional Vedic guidance, published educational resources and existing Kundli and astrologer services. No guaranteed outcomes.", alternates: { canonical: "/remedies" } };
const remedyTopics = [
    ["Career & Business", "Discuss professional decisions, workplace concerns and personal priorities with an astrologer."],
    ["Love & Relationships", "Explore relationship concerns and emotional compatibility through a personal consultation."],
    ["Finance & Stability", "Reflect on financial concerns without treating astrology as investment advice or a promise of returns."],
    ["Health & Wellbeing", "Consider optional spiritual practices alongside appropriate professional care, never instead of it."],
    ["Marriage & Compatibility", "Discuss compatibility and relationship patterns with guidance based on your circumstances."],
    ["Spiritual Growth", "Explore reflection, meditation and devotional practices where appropriate to your beliefs."],
] as const;
export default function RemediesPage() {
    return <main className={s.page}>
    <section className={s.hero}><div className={s.art} aria-hidden="true"><span /><span /><span /></div><div className={s.heroContent}>
      <p className={s.eyebrow}>VEDIC GUIDANCE · PERSONAL CHOICE</p><h1>Small practices.<br /><em>Thoughtful guidance.</em></h1>
      <p>Explore traditional astrology remedies with clarity and care. Personal recommendations belong in the context of your chart, your circumstances and your choices.</p>
      <div className={s.actions}><Link href="/astrologers">Explore astrologers</Link><Link href="#guidance">Read published guidance</Link></div><p className={s.note}>Educational information, not a personalized reading or a guaranteed outcome.</p>
    </div></section>
    <section className={s.section} aria-labelledby="topics-title"><p className={s.eyebrow}>EXPLORE YOUR CONCERNS</p><h2 id="topics-title">A considered place to begin</h2><p className={s.intro}>Choose a topic to learn how to approach a consultation. These introductions are not chart-based recommendations.</p>
      <div className={s.grid}>{remedyTopics.map(([title, description], i) => <details className={s.topic} key={title}><summary><span className={s.number} aria-hidden="true">0{i + 1}</span><h3>{title}</h3><span aria-hidden="true">+</span></summary><p>{description}</p><Link href="/astrologers">Explore consultation options →</Link></details>)}</div>
    </section>
    <section className={`${s.section} ${s.personal}`} aria-labelledby="personal-title"><div><p className={s.eyebrow}>YOUR CHART, YOUR CONTEXT</p><h2 id="personal-title">Personal guidance starts with an authorized reading</h2><p>The existing Kundli experience may include suggested remedies within its interpretation. An astrologer-authored report may also include traditional guidance, subject to its existing ownership and access rules.</p><p>No birth details yet? Continue through the existing Kundli flow to see its requirements. This page does not generate a reading, purchase an entitlement or access another person’s chart.</p><Link className={s.inlineLink} href="/kundli">Open existing Kundli services →</Link></div><aside><h3>What to expect</h3><ol><li>Use your normal customer account.</li><li>Review existing service requirements and any consent request.</li><li>Read only guidance available in your authorized chart or report.</li></ol><p>AI-generated interpretations, where available in existing services, remain subject to their current consent, usage and eligibility controls.</p></aside></section>
    <CustomerRemedies />
    <section className={s.section} aria-labelledby="availability-title"><h2 id="availability-title">New personalized readings: availability</h2><p className={s.intro}>Existing finalized report remedies can be viewed above. A chart selector and standalone saved-remedy history are not available here. The existing website Kundli generation form uses a retired service; it cannot currently create a new reading. Explore the existing astrologer consultation options for personal guidance. No payment or consultation begins automatically.</p></section>
    <section id="guidance" className={s.section} aria-labelledby="guidance-title"><p className={s.eyebrow}>FROM THE KNOWLEDGE CENTER</p><h2 id="guidance-title">Published remedy guidance</h2><p className={s.intro}>Educational articles from the shared catalogue. These are not personalized prescriptions.</p><Suspense fallback={<div role="status" className={s.state}>Loading published guidance…</div>}><RemedyGuidance /></Suspense></section>
    <section className={`${s.section} ${s.safety}`} aria-labelledby="safety-title"><h2 id="safety-title">Care comes first</h2><p>Astrology and spiritual practices do not replace medical, mental-health, legal or financial advice. Do not change treatment, fast when unsafe, or purchase gemstones because of a promised cure or guaranteed result. You can decline any suggested practice.</p><Link href="/astrologers">Discuss your questions with an astrologer →</Link></section>
  </main>;
}
