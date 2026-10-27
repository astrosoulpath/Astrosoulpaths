import Link from 'next/link';
import s from './cinematic-home.module.css';
export const HOME_SERVICES=[
 {title:'Chat consultations',mark:'☿',copy:'Bring your questions to a real astrologer, in a language you are comfortable with.',href:'/astrologers',state:'Profile availability · confirmation required'},
 {title:'Audio consultations',mark:'☽',copy:'Make space for an unhurried conversation. Review supported modes on the profile.',href:'/astrologers',state:'Supported profiles · confirmation required'},
 {title:'Professional Kundli',mark:'◇',copy:'Explore owned finalized reports. New generation requires secure availability and customer consent.',href:'/kundli',state:'Reports available · generation inactive'},
 {title:'Daily horoscope',mark:'♌',copy:'A fresh zodiac perspective, with free readings and separate personalized access.',href:'/horoscope',state:'Free readings · premium entitlement checked'},
 {title:'Traditional remedies',mark:'✧',copy:'Explore published editorial guidance and authorized report-based suggestions.',href:'/remedies',state:'Published content · no guaranteed outcomes'},
 {title:'Numerology',mark:'Ⅸ',copy:'Find astrologers who list Numerology expertise. No standalone calculation service is enabled.',href:'/astrologers',state:'Specialist discovery only'},
 {title:'AI-assisted guidance',mark:'☉',copy:'Learn about supported AI features, consent, access and the limits of interpretations.',href:'/services/vedic-guidance',state:'Information · application access varies'},
 {title:'Soul Bazaar',mark:'⌑',copy:'Browse the existing approved product catalogue, without initiating a purchase.',href:'/marketplace',state:'Catalogue only · checkout not enabled'},
] as const;
export function ServicesSection(){return <section id="services" className={s.section} aria-labelledby="services-heading"><div className={s.sectionHead}><div><p className={s.eyebrow}>Thoughtfully connected</p><h2 id="services-heading">Wisdom for your <em>everyday world.</em></h2></div><p>A considered collection of experiences. Choose what speaks to you.</p></div><div className={s.serviceGrid}>{HOME_SERVICES.map(item=><Link key={item.title} className={s.serviceCard} href={item.href}><span aria-hidden="true">{item.mark}</span><h3>{item.title}</h3><p>{item.copy}</p><small>{item.state}</small><span className={s.textLink}>Explore <span aria-hidden="true">↗</span></span></Link>)}</div></section>;}
