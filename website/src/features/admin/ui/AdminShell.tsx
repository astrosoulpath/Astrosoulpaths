"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu, Orbit, ShieldCheck, X } from "lucide-react";
import { logoutAdmin } from "../auth/admin-session";
import { adminModules, adminPageInfo, isAdminAuthRoute } from "./admin-navigation";
import { AdminIcon } from "./AdminIcon";
import { AdminPageHeader } from "./AdminUI";
import styles from "./admin-shell.module.css";

function subscribeIdentity(callback: () => void) {
  window.addEventListener("storage",callback); window.addEventListener("focus",callback);
  return () => { window.removeEventListener("storage",callback); window.removeEventListener("focus",callback); };
}
function identitySnapshot() {
  try { return localStorage.getItem("asp_admin_user") ?? ""; } catch { return ""; }
}
function displayIdentity(value: string) {
  try { const user=JSON.parse(value); return typeof user.name === "string" && user.name.trim() ? user.name : "Administrator"; } catch { return "Administrator"; }
}

export function AdminShell({children}: {children:ReactNode}) {
  const pathname=usePathname();
  // Authentication continues to be enforced by the existing proxy/session boundary.
  if (isAdminAuthRoute(pathname)) return children;
  return <ProtectedAdminShell key={pathname} pathname={pathname}>{children}</ProtectedAdminShell>;
}

function ProtectedAdminShell({children,pathname}: {children:ReactNode;pathname:string}) {
  const router=useRouter();
  const [drawer,setDrawer]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [loggingOut,setLoggingOut]=useState(false);
  const [error,setError]=useState("");
  const sidebar=useRef<HTMLElement>(null);
  const toggle=useRef<HTMLButtonElement>(null);
  const content=useRef<HTMLDivElement>(null);
  const identity=displayIdentity(useSyncExternalStore(subscribeIdentity,identitySnapshot,()=>""));
  const info=adminPageInfo(pathname);
  const active=(href:string)=>pathname===href || (href!=="/admin" && pathname.startsWith(`${href}/`));
  useEffect(()=>{
    if (!drawer) return;
    const original=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const workspace=content.current;
    const trigger=toggle.current;
    workspace?.setAttribute("inert","");
    const first=sidebar.current?.querySelector<HTMLElement>("button,a"); first?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==="Escape") { event.preventDefault(); setDrawer(false); }
      if(event.key==="Tab") {
        const items=Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')??[]).filter(item=>item.getClientRects().length>0);
        const first=items[0],last=items.at(-1);
        if(event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus(); }
        else if(!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown",keyboard);
    const resized=()=>{if(window.innerWidth>=1024)setDrawer(false);}; window.addEventListener("resize",resized);
    return()=>{document.body.style.overflow=original;workspace?.removeAttribute("inert");document.removeEventListener("keydown",keyboard);window.removeEventListener("resize",resized);trigger?.focus();};
  },[drawer]);
  async function signOut() {
    if(loggingOut)return;
    setLoggingOut(true); setError("");
    try { await logoutAdmin(); router.replace("/admin/login"); router.refresh(); }
    catch { setError("Logout could not finish. Please retry before leaving this device."); }
    finally {setLoggingOut(false);}
  }
  return <div className={`${styles.shell} ${collapsed?styles.collapsed:""}`} data-admin-shell>
    <a href="#admin-workspace" className={styles.skip}>Skip to Admin content</a>
    {drawer && <button type="button" className={styles.backdrop} aria-label="Close navigation" onClick={()=>setDrawer(false)}/>}
    <aside ref={sidebar} id="admin-navigation" className={`${styles.sidebar} ${drawer?styles.open:""}`} aria-label="Admin sidebar" role={drawer?"dialog":undefined} aria-modal={drawer?true:undefined}>
      <div className={styles.brandRow}><Link href="/admin" className={styles.brand} aria-label="Astro Soul Path Admin Dashboard"><span className={styles.brandMark}><Orbit size={32} strokeWidth={1.2}/></span><span className={styles.navLabel}><strong>Astro Soul Path</strong><small>ADMIN PANEL</small></span></Link><button type="button" className={styles.close} onClick={()=>setDrawer(false)} aria-label="Close Admin navigation"><X size={20}/></button></div>
      <nav aria-label="Admin navigation" className={styles.navigation}>
        <Link href="/admin" className={active("/admin")?styles.active:""} aria-current={active("/admin")?"page":undefined} title="Dashboard"><AdminIcon name="dashboard"/><span className={styles.navLabel}>Dashboard</span></Link>
        {["People","Operations","Platform"].map(group=><div key={group}><p className={`${styles.groupLabel} ${styles.navLabel}`}>{group}</p>{adminModules.filter(item=>item.group===group).map(item=><Link key={item.href} href={item.href} className={active(item.href)?styles.active:""} aria-current={active(item.href)?"page":undefined} title={item.title}><AdminIcon name={item.icon}/><span className={styles.navLabel}>{item.title}</span></Link>)}</div>)}
        <p className={styles.sidebarNote}><ShieldCheck size={17} aria-hidden="true"/><span className={styles.navLabel}>Authorized Admin workspace</span></p>
      </nav>
      <button type="button" className={styles.collapse} onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed}>{collapsed?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}<span className={styles.navLabel}>Collapse navigation</span></button>
    </aside>
    <div className={styles.workspace} ref={content}>
      <header className={styles.topbar}><div className={styles.topbarStart}><button ref={toggle} type="button" className={styles.menu} onClick={()=>setDrawer(true)} aria-label="Open Admin navigation" aria-controls="admin-navigation" aria-expanded={drawer}><Menu size={22}/></button><span className={styles.workspaceLabel}>Platform workspace</span></div>
        <div className={styles.account}><span className={styles.avatar} aria-hidden="true">{identity.slice(0,1).toUpperCase()}</span><span className={styles.identity}><strong>{identity}</strong><small>Admin</small></span><button type="button" disabled={loggingOut} onClick={()=>void signOut()} className={styles.logout}><LogOut size={17} aria-hidden="true"/><span>{loggingOut?"Signing out…":"Log out"}</span></button></div>
      </header>
      <div id="admin-workspace" tabIndex={-1} className={styles.main}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}><Link href="/admin">Dashboard</Link>{pathname!=="/admin" && <><ChevronRight size={13} aria-hidden="true"/><span aria-current="page">{info.title}</span></>}</nav>
        {pathname!=="/admin" && <AdminPageHeader title={info.title} description={info.description}/>}
        {error && <p role="alert" className={styles.logoutError}>{error}</p>}
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}><span>Astro Soul Path</span><span>Administration · Secure workspace</span></footer>
      </div>
    </div>
  </div>;
}
