"use client";
import Image from "next/image";
import { useState } from "react";
import s from "./marketplace.module.css";
export function safePortrait(value?:string|null){try{const u=new URL(value||'');return !u.username&&!u.password&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))?u.toString():null;}catch{return null;}}
export default function AstrologerPortrait({name,url}:{name:string;url?:string|null}){const [failed,setFailed]=useState<string|null>(null),src=safePortrait(url),initials=name.trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||'').join('').toUpperCase();return src&&failed!==src?<Image src={src} width={88} height={88} unoptimized alt={`${name} profile`} className={s.portrait} onError={()=>setFailed(src)}/>:<span className={s.initials} aria-label={`${name} profile initials`}>{initials||'—'}</span>;}
