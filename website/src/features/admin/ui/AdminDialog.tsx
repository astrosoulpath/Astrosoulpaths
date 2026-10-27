"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Presentation-only modal; caller retains all validation and actions. */
export function AdminDialog({label,onClose,children}: {label:string;onClose:()=>void;children:ReactNode}) {
  const backdrop=useRef<HTMLDivElement>(null);
  const dialog=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const changed:HTMLElement[]=[];
    let node:HTMLElement|null=backdrop.current;
    while(node?.parentElement){
      const parent=node.parentElement;
      for(const sibling of Array.from(parent.children))if(sibling!==node && sibling instanceof HTMLElement && !sibling.inert){sibling.inert=true;changed.push(sibling);}
      if(parent.hasAttribute('data-admin-shell'))break;
      node=parent;
    }
    const focusable=()=>Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')??[]).filter(e=>e.getClientRects().length>0);
    (focusable()[0]??dialog.current)?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
      if(event.key==='Tab'){
        const items=focusable(),first=items[0],last=items.at(-1);
        if(!first){event.preventDefault();dialog.current?.focus();}
        else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);for(const item of changed)item.inert=false;document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[]);
  return <div ref={backdrop} className="admin-dialog-backdrop"><div ref={dialog} className="admin-dialog-surface" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div></div>;
}
