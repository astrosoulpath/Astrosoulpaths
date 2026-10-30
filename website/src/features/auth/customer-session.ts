import {sessionCandidate,verifyNavigationSession,type NavigationSession} from './public-auth';
export type CustomerSession=NavigationSession&{portal:'customer';role:'CUSTOMER'};
const pending=new Map<string,Promise<CustomerSession|null>>();
/** Same provider renewal and backend verifier used by navigation. Never authorizes from Firebase alone. */
export async function verifyCustomerSession(signal:AbortSignal):Promise<CustomerSession|null>{
 const before=sessionCandidate('/dashboard');if(!before||before.portal!=='customer')return null;
 let work=pending.get(before.snapshot);
 if(!work){work=(async()=>{const verified=await verifyNavigationSession('/dashboard',AbortSignal.timeout(28000));if(!verified)return null;if(verified.portal!=='customer'||verified.role!=='CUSTOMER')throw Error('Customer authorization could not be verified.');
  const after=sessionCandidate('/dashboard');if(!after||after.portal!=='customer')throw Error('Account changed. Sign in again.');
  if(after.token.startsWith('aspctx.')){const uid=await firebaseIdentityUid(AbortSignal.timeout(10000));if(!verified.firebaseUid||uid!==verified.firebaseUid)throw Error('Firebase and Customer identities do not match. Sign in again.');if(sessionCandidate('/dashboard')?.snapshot!==after.snapshot)throw Error('Account changed.');}
  const descriptor=JSON.parse(localStorage.getItem('asp_user')||'{}');
  if(descriptor.id&&descriptor.id!==verified.id)throw Error('The saved account does not match the backend identity. Sign in again.');
  // Repair a legacy routing descriptor only after server proof. No identity
  // linking, role grant, token minting, refresh-token removal or DB write.
  if(descriptor.portal!=='customer'||!descriptor.id||descriptor.role!=='CUSTOMER'){
   const normalized={...(descriptor.id===verified.id?descriptor:{}),id:verified.id,portal:'customer',role:'CUSTOMER',name:verified.name,...(verified.firebaseUid?{firebaseUid:verified.firebaseUid}:{})};
   localStorage.setItem('asp_user',JSON.stringify(normalized));localStorage.setItem('asp_customer_user',JSON.stringify(normalized));localStorage.setItem('asp_customer_access_token',after.token);
   document.cookie='asp_user='+encodeURIComponent(JSON.stringify({portal:'customer',role:'CUSTOMER',isAstrologer:false}))+'; path=/; max-age=86400; SameSite=Lax'+(window.location.protocol==='https:'?'; Secure':'');
  }
  return verified as CustomerSession;
 })().finally(()=>pending.delete(before.snapshot));pending.set(before.snapshot,work);}
 if(signal.aborted)throw Error('Customer verification cancelled.');
 return new Promise((resolve,reject)=>{const abort=()=>reject(Error('Customer verification cancelled.'));signal.addEventListener('abort',abort,{once:true});work!.then(value=>{if(!signal.aborted)resolve(value);},reject).finally(()=>signal.removeEventListener('abort',abort));});
}
async function firebaseIdentityUid(signal:AbortSignal){let timer:ReturnType<typeof setTimeout>|undefined;let abort:()=>void=()=>{};try{return await Promise.race([(async()=>{const {firebaseAuth}=await import('@/lib/firebaseClient');await firebaseAuth.authStateReady();return firebaseAuth.currentUser?.uid??null;})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Verification unavailable')),10000);abort=()=>reject(Error('Verification cancelled'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});})]);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}}
export async function hasFirebaseIdentity(signal:AbortSignal){return !!await firebaseIdentityUid(signal);}
