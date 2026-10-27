"use client";
import { useEffect,useState,type FormEvent } from "react";
import { getPublicAstrologers,type PublicAstrologer } from "@/services/astrologerService";
import { MarketplaceAstrologerCard } from "./MarketplaceAstrologerCard";
import s from "./marketplace.module.css";
const empty={search:"",language:"",expertise:"",online:false,sort:"recommended"};
export function AstrologersGrid(){
 const [draft,setDraft]=useState({...empty}),[query,setQuery]=useState({...empty,page:1}),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<PublicAstrologer[]>([]),[total,setTotal]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [choices,setChoices]=useState<{languages:string[];expertise:string[]}>({languages:[],expertise:[]});
 useEffect(()=>{let active=true;const controller=new AbortController();setBusy(true);setError("");void getPublicAstrologers({...query,online:query.online?true:undefined,limit:12},controller.signal).then(result=>{if(!active)return;setRows(result.data);setTotal(result.meta.total);setChoices(old=>({languages:[...new Set([...old.languages,...result.data.flatMap(r=>r.languages)])].sort(),expertise:[...new Set([...old.expertise,...result.data.flatMap(r=>r.expertise)])].sort()}));}).catch(()=>{if(active){setRows([]);setError("Astrologers could not be loaded. Please check your connection and retry.");}}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;controller.abort();};},[query,refresh]);
 function apply(event:FormEvent){event.preventDefault();setQuery({...draft,page:1});}
 function reset(){setDraft({...empty});setQuery({...empty,page:1});}
 const pages=Math.max(1,Math.ceil(total/12));
 return <section className={s.discovery} aria-label="Astrologer discovery">
 <form className={s.filters} onSubmit={apply}><div className={s.filterGrid}>
 <div><label htmlFor="astrologer-search">Name or topic</label><input id="astrologer-search" type="search" maxLength={120} placeholder="Search name or expertise" value={draft.search} onChange={e=>setDraft({...draft,search:e.target.value})}/></div>
 <div><label htmlFor="astrologer-language">Language</label><input id="astrologer-language" list="astrologer-languages" maxLength={120} placeholder="All languages" value={draft.language} onChange={e=>setDraft({...draft,language:e.target.value})}/><datalist id="astrologer-languages">{choices.languages.map(x=><option key={x} value={x}/>)}</datalist></div>
 <div><label htmlFor="astrologer-expertise">Expertise</label><input id="astrologer-expertise" list="astrologer-skills" maxLength={120} placeholder="All expertise" value={draft.expertise} onChange={e=>setDraft({...draft,expertise:e.target.value})}/><datalist id="astrologer-skills">{choices.expertise.map(x=><option key={x} value={x}/>)}</datalist></div>
 <div><label htmlFor="astrologer-sort">Sort by</label><select id="astrologer-sort" value={draft.sort} onChange={e=>setDraft({...draft,sort:e.target.value})}><option value="recommended">Recommended</option><option value="rating-high">Highest rating</option><option value="experience-high">Most experienced</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div>
 </div><div className={s.filterActions}><label className={s.check}><input type="checkbox" checked={draft.online} onChange={e=>setDraft({...draft,online:e.target.checked})}/>Online only</label><button type="submit" disabled={busy}>Apply filters</button><button className={s.secondary} type="button" disabled={busy} onClick={reset}>Reset</button><button className={s.secondary} type="button" disabled={busy} onClick={()=>setRefresh(x=>x+1)}>Refresh</button></div><p className={s.hint}>Apply to update results. Language labels match the astrologer’s listing. Availability can change; booking rechecks it.</p></form>
 <div className={s.resultsHeading}><h2>Find your astrologer</h2><p aria-live="polite">{busy?"Loading astrologers…":error?"Discovery unavailable":`${total} matching ${total===1?"astrologer":"astrologers"} · Page ${query.page} of ${pages}`}</p></div>
 {error&&<div className={s.state} role="alert"><h3>Unable to load astrologers</h3><p>{error}</p><button type="button" onClick={()=>setRefresh(x=>x+1)}>Retry discovery</button></div>}
 {busy?<div className={s.grid} role="status" aria-label="Loading astrologers">{[1,2,3].map(i=><div key={i} className={s.skeleton} aria-hidden="true"/>)}</div>:!error&&rows.length===0?<div className={s.state}><h3>No matching astrologers</h3><p>No eligible profiles match these filters. Try a different language or clear your search. No sample profiles have been substituted.</p><button type="button" onClick={reset}>Clear filters</button></div>:!error&&<div className={s.grid}>{rows.map(row=><MarketplaceAstrologerCard key={row.id} astrologer={row}/>)}</div>}
 {!busy&&!error&&pages>1&&<nav className={s.pagination} aria-label="Astrologer pages"><button type="button" disabled={query.page<=1} onClick={()=>setQuery({...query,page:query.page-1})}>Previous</button><span>Page {query.page} of {pages}</span><button type="button" disabled={query.page>=pages} onClick={()=>setQuery({...query,page:query.page+1})}>Next</button></nav>}
 </section>;
}
