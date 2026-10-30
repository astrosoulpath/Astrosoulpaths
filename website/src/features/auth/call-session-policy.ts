import {publicAuthBase,sessionCandidate,type NavigationSession} from './public-auth';
export function callRouteAllowed(path:string){return !/^\/(?:admin(?:\/|$)|login(?:\/|$)|signup(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$)|verify-otp(?:\/|$)|astrologer\/(?:login|signup|register|onboarding|pending)(?:\/|$))/.test(path);}
/** Read-only eligibility: never invokes Customer reservation recovery or starts a call. */
export async function callSessionEligible(verified:NavigationSession,path:string,signal:AbortSignal){
 if(!callRouteAllowed(path))return false;
 const before=sessionCandidate(path);if(!before||before.portal!==verified.portal)return false;
 async function read(route:string){const r=await fetch(publicAuthBase()+route,{headers:{Authorization:'Bearer '+before!.token,Accept:'application/json'},credentials:'omit',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});const b=await r.json().catch(()=>null);if(sessionCandidate(path)?.snapshot!==before!.snapshot)throw Error('Account changed');if(!r.ok||b?.success!==true)throw Error('Communication availability could not be verified');return b.data;}
 if(verified.portal==='astrologer'){
  if(verified.role!=='ASTROLOGER'||verified.nextStep!=='OPEN_ASTROLOGER_DASHBOARD')return false;
  const dashboard=await read('/astrologer/dashboard');if(dashboard?.userId!==verified.id||dashboard.isApproved!==true||dashboard.isVerified!==true)return false;
  if(dashboard.isOnline===true)return true;
  const queue=await read('/consultations/astrologer/current');return Array.isArray(queue)&&queue.some(c=>live(c)&&c.astrologerId===verified.id);
 }
 if(verified.role!=='CUSTOMER')return false;
 for(const status of ['ACTIVE','PENDING']){const rows=await read('/consultations/history?page=1&limit=1&status='+status);if(Array.isArray(rows)&&rows.some(c=>live(c)&&c.userId===verified.id))return true;}
 return false;
}
function live(call:Record<string,unknown>){return !!call&&['ACTIVE','PENDING'].includes(String(call.status))&&!call.endedAt&&typeof call.expiresAt==='string'&&new Date(call.expiresAt).getTime()>Date.now();}
