import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, CircleAlert, Inbox, LoaderCircle } from "lucide-react";

export function AdminPageHeader({ title, description, actions, back = true }: {title: string; description?: string; actions?: ReactNode; back?: boolean}) {
  return <header className="admin-page-header"><div><p className="admin-eyebrow">Astro Soul Path · Administration</p><h1>{title}</h1>{description && <p className="admin-description">{description}</p>}</div>
    <div className="admin-header-actions">{actions}{back && <Link href="/admin" className="admin-back"><ArrowLeft size={17} aria-hidden="true"/>Back to Dashboard</Link>}</div></header>;
}
export function AdminStatCard({title,value,description,icon}: {title:string;value:ReactNode;description:string;icon?:ReactNode}) {
  return <article className="admin-stat"><div className="admin-stat-heading"><p>{title}</p><span className="admin-icon-tile" aria-hidden="true">{icon}</span></div><p className="admin-stat-number">{value}</p><p className="admin-description">{description}</p></article>;
}
export function AdminSectionCard({title,description,children,actions}: {title:string;description?:string;children:ReactNode;actions?:ReactNode}) {
  return <section className="admin-section-card"><div className="admin-section-heading"><div><h2>{title}</h2>{description && <p className="admin-description">{description}</p>}</div>{actions}</div>{children}</section>;
}
export function AdminActionButton({children,...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`admin-action ${props.className ?? ""}`}>{children}</button>;
}
export function AdminEmptyState({title="No records yet",children}: {title?:string;children?:ReactNode}) {
  return <div className="admin-state"><Inbox aria-hidden="true"/><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
export function AdminLoadingState({label="Loading verified records…"}: {label?:string}) {
  return <div className="admin-state" role="status"><LoaderCircle className="admin-spinner" aria-hidden="true"/><p>{label}</p><div className="admin-skeleton"/><div className="admin-skeleton"/></div>;
}
export function AdminErrorState({title="Unable to load records",children,actions}: {title?:string;children?:ReactNode;actions?:ReactNode}) {
  return <section className="admin-state admin-error" role="alert"><CircleAlert aria-hidden="true"/><h2>{title}</h2>{children && <p>{children}</p>}{actions}</section>;
}
export function AdminModuleLink({href,title,description,icon}: {href:string;title:string;description:string;icon:ReactNode}) {
  return <Link href={href} className="admin-module-card"><div className="admin-module-top"><span className="admin-icon-tile" aria-hidden="true">{icon}</span><ArrowUpRight size={19} aria-hidden="true"/></div><h3>{title}</h3><p>{description}</p></Link>;
}
