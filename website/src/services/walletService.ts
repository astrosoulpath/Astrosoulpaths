import {publicAuthBase,sessionCandidate} from '@/features/auth/public-auth';
import {verifyCustomerSession} from '@/features/auth/customer-session';
export class WalletAccessError extends Error{constructor(public status:number){super('Customer wallet access must be verified. Sign in normally or retry verification.');this.name='WalletAccessError';}}
async function readWallet(path:'/wallet'|'/wallet/history'){
 const signal=AbortSignal.timeout(25000),verified=await verifyCustomerSession(signal);if(!verified)throw new WalletAccessError(401);
 const owner=sessionCandidate('/dashboard');if(!owner||owner.portal!=='customer')throw new WalletAccessError(401);
 const response=await fetch(publicAuthBase()+path,{headers:{Accept:'application/json',Authorization:'Bearer '+owner.token},credentials:'omit',cache:'no-store',signal});const body=await response.json().catch(()=>null);
 if(sessionCandidate('/dashboard')?.snapshot!==owner.snapshot)throw new WalletAccessError(401);
 if(response.status===401||response.status===403)throw new WalletAccessError(response.status);
 if(!response.ok||body?.success!==true)throw Error('Wallet records are temporarily unavailable. Retry without changing your account.');return body;
}
export async function getWallet(){const body=await readWallet('/wallet');const wallet=body.data?.wallet??body.data;const numeric=(value:unknown)=>typeof value==='number'?Number.isFinite(value):typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value));if(!wallet||![wallet.balance,wallet.availableBalance,wallet.lockedBalance].every(numeric)||typeof wallet.currency!=='string'||!(/^[A-Z]{3}$/).test(wallet.currency))throw Error('Wallet response was incomplete. No balance has been assumed.');return body;}
export function getWalletHistory(){return readWallet('/wallet/history');}
/** Deprecated bypass never sends a mutation. The existing secured checkout owns recharges. */
export async function rechargeWallet(amount:number):Promise<never>{void amount;throw Error('Use the existing secured wallet recharge flow.');}
