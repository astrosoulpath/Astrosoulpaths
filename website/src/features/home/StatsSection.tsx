'use client';
import {useEffect,useState} from 'react';
import {getPublicAstrologers} from '@/services/astrologerService';
import s from './cinematic-home.module.css';
export function StatsSection(){const [count,setCount]=useState<number|null>(null),[error,setError]=useState(false);useEffect(()=>{let active=true;const abort=new AbortController();getPublicAstrologers({page:1,limit:1},abort.signal).then(r=>{if(active)setCount(r.meta.total);}).catch(()=>{if(active)setError(true);});return()=>{active=false;abort.abort();};},[]);return <section className={s.catalogueNote} aria-label="Shared catalogue information"><div><strong>{error?'—':count===null?'…':new Intl.NumberFormat('en').format(count)}</strong> {count===1?'eligible astrologer':'eligible astrologers'} in the current catalogue</div><p>{error?'Live catalogue count is unavailable.':count===0?'A growing platform. No sample profiles substituted.':'A live directory count, not a claim of production usage.'}</p></section>;}
