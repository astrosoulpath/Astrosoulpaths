"use client";
import {useEffect,useRef,useState} from 'react';
import {sessionCandidate} from './public-auth';
import {hasFirebaseIdentity,verifyCustomerSession,type CustomerSession} from './customer-session';
export type CustomerAuthState={status:'loading'|'authenticated'|'anonymous'|'wrong-portal'|'recovery'|'error';customer:CustomerSession|null;message:string};
const initial:CustomerAuthState={status:'loading',customer:null,message:''};
export function useCustomerSession(){const [state,setState]=useState<CustomerAuthState>(initial),[attempt,setAttempt]=useState(0);const verified=useRef<string|undefined>(undefined);
 useEffect(()=>{let alive=true,controller:AbortController|undefined,pendingKey:string|undefined;const update=()=>{
  const candidate=sessionCandidate('/dashboard'),key=candidate?.snapshot??'anonymous';if(pendingKey===key)return;controller?.abort();controller=new AbortController();const current=controller;pendingKey=key;
  if(key!==verified.current)setState(initial);
  void(async()=>{try{
   if(candidate&&candidate.portal!=='customer'){if(alive&&!current.signal.aborted)setState({status:'wrong-portal',customer:null,message:'This page requires Customer access. Your Admin or Astrologer session has not been changed.'});return;}
   if(!candidate){const identity=await hasFirebaseIdentity(current.signal);if(alive&&!current.signal.aborted)setState({status:identity?'recovery':'anonymous',customer:null,message:identity?'Google/email is signed in, but backend Customer access needs to be restored. Continue using your original sign-in method.':''});return;}
   const customer=await verifyCustomerSession(current.signal);if(!alive||current.signal.aborted)return;verified.current=customer?sessionCandidate('/dashboard')?.snapshot:undefined;setState(customer?{status:'authenticated',customer,message:''}:{status:'recovery',customer:null,message:'Your Customer session is no longer authorized. Sign in normally to reconnect it.'});
  }catch{if(alive&&!current.signal.aborted){verified.current=undefined;setState({status:'error',customer:null,message:'Customer access could not be verified. Check your connection and retry; saved records have not been changed.'});}}finally{if(alive&&!current.signal.aborted)pendingKey=undefined;}
  })();};const expired=()=>{verified.current=undefined;setState(initial);update();};update();window.addEventListener('focus',update);window.addEventListener('storage',update);window.addEventListener('asp-auth-changed',update);window.addEventListener('asp-customer-session-expired',expired);
  return()=>{alive=false;controller?.abort();window.removeEventListener('focus',update);window.removeEventListener('storage',update);window.removeEventListener('asp-auth-changed',update);window.removeEventListener('asp-customer-session-expired',expired);};
 },[attempt]);return{...state,retry:()=>setAttempt(value=>value+1)};
}
