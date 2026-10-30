import {publicAuthBase,sessionCandidate,verifyNavigationSession} from '../auth/public-auth';
import {subscriptionPath,type SubscriptionRole} from './subscription-api';
export type InboxItem={id:string;title:string;body:string;type:string|null;isRead:boolean;createdAt:string};
export type Inbox={ownerId:string;items:InboxItem[];unreadCount:number};
export async function inboxRequest(role:SubscriptionRole,signal:AbortSignal,path='',mark=false):Promise<Inbox|null>{
  if(mark ? !/^\/(read-all|[A-Za-z0-9_-]{1,120}\/read)$/.test(path) : path!=='')throw Error('Invalid notification operation.');
  const route=subscriptionPath(role),identity=await verifyNavigationSession(route,signal),session=sessionCandidate(route);
  if(!identity||!session||identity.portal.toUpperCase()!==role)throw Error('Sign in to the correct account to view notifications.');
  const snapshot=session.snapshot;
  const response=await fetch(publicAuthBase()+'/notifications'+path,{method:mark?'PATCH':'GET',headers:{Authorization:'Bearer '+session.token},credentials:'omit',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
  const result=await response.json().catch(()=>null);
  if(signal.aborted||sessionCandidate(route)?.snapshot!==snapshot)throw Error('Account changed. Reopen notifications.');
  if(!response.ok||result?.success!==true)throw Error('Notifications are temporarily unavailable. Please retry.');
  if(mark)return null;
  const value=result.data;
  if(value?.ownerId!==identity.id||!Array.isArray(value.items)||value.items.length>100||!Number.isInteger(value.unreadCount)||value.unreadCount<0||value.items.some((r:InboxItem)=>!r||typeof r.id!=='string'||typeof r.title!=='string'||typeof r.body!=='string'||typeof r.isRead!=='boolean'||!Number.isFinite(Date.parse(r.createdAt))))throw Error('Notification response could not be verified.');
  return value;
}
