"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { kundliSessionSnapshot } from "@/services/kundliService";
function subscribe(notify:()=>void){const events=["asp-auth-changed","storage","focus","pageshow"];events.forEach(event=>window.addEventListener(event,notify));document.addEventListener("visibilitychange",notify);const timer=setInterval(notify,1000);return()=>{events.forEach(event=>window.removeEventListener(event,notify));document.removeEventListener("visibilitychange",notify);clearInterval(timer);};}
export default function SavedKundliSessionBoundary({children}:{children:ReactNode}){const owner=useSyncExternalStore(subscribe,kundliSessionSnapshot,()=>"");return <div key={owner}>{children}</div>;}
