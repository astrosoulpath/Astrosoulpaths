import Link from "next/link";
import type { PublicAstrologer } from "@/services/astrologerService";
import AstrologerPortrait from "./AstrologerPortrait";
import { astrologerRate, safeDiscoveryReturn } from "./marketplace-format";
import s from "./marketplace.module.css";
export function MarketplaceAstrologerCard({astrologer:a}:{astrologer:PublicAstrologer}){
 const href=`/astrologers/${encodeURIComponent(a.id)}`;
 const ready=a.isOnline&&!a.isBusy&&a.pricePerMin>0;
 const rate=astrologerRate(a);
 return <article className={s.card}><div className={s.cardHead}><Link href={href} aria-label={`View ${a.name}`}><AstrologerPortrait name={a.name} url={a.avatarUrl}/></Link><div><Link className={s.name} href={href}><h3>{a.name}</h3></Link>{a.isVerified===true&&<span className={s.verified}>Verified profile</span>}<p className={s.availability}>{a.isBusy?"In consultation":a.isOnline?"Online":"Offline"}</p></div></div>
 <p className={s.expertise}>{a.expertise.length?a.expertise.join(' · '):"Expertise not supplied"}</p>
 <dl className={s.facts}><div><dt>Experience</dt><dd>{a.experience>0?`${a.experience} years`:"Not supplied"}</dd></div><div><dt>Languages</dt><dd>{a.languages.length?a.languages.join(', '):"Not supplied"}</dd></div><div><dt>Rating</dt><dd>{a.rating>0?`${a.rating.toFixed(1)} / 5`:a.reviewCount===0?"New astrologer":"No rating supplied"}{a.reviewCount!==undefined&&<small>{a.reviewCount} {a.reviewCount===1?"review":"reviews"}</small>}</dd></div></dl>
 <div className={s.rate}><span>Consultation fee</span><strong>{rate}</strong></div><div className={s.cardActions}>{ready?<Link className={s.primaryLink} href={safeDiscoveryReturn(a.id)}>Chat Now</Link>:<span className={s.unavailable}>{a.isBusy?"Currently busy":!a.isOnline?"Currently offline":"Pricing unavailable"}</span>}<Link className={s.profileLink} href={href}>View Profile →</Link></div></article>;
}
