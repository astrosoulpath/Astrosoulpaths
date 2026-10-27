import type { Metadata } from "next";
import { AstrologersGrid } from "@/features/astrologers/AstrologersGrid";
import s from "@/features/astrologers/marketplace.module.css";
export const metadata:Metadata={title:"Find an Astrologer | Astro Soul Path",description:"Explore approved astrologer profiles, listed expertise, languages, current availability and consultation fees.",alternates:{canonical:"/astrologers"}};
export default function AstrologersPage(){return <main className={s.page}><div className={s.wrap}><header className={s.hero}><p className={s.eyebrow}>ASTRO SOUL PATH · PERSONAL GUIDANCE</p><h1>A thoughtful conversation starts with the right astrologer.</h1><p>Explore approved profiles, find a language you’re comfortable with and review consultation details before you decide. Only eligible profiles from the shared catalogue appear here.</p></header><AstrologersGrid/></div></main>;}
