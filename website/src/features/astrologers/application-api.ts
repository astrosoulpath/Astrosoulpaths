import { publicAuthBase } from '../auth/public-auth';
export type ApplicationStatus = {
  status:'PROFILE_COMPLETION'|'PENDING_REVIEW'|'APPROVED'|'REJECTED'|'NEEDS_CHANGES'|'SUSPENDED';
  hasProfile:boolean; nextStep:string; reviewStatusAvailable:boolean;
  correctionsAvailable:boolean; applicationVersion:number; requestedFields:string[];
  correctionReason:string|null; applicationCountryCode:string|null;
  user:{id:string; name:string|null; email:string|null; phone:string|null; avatarUrl:string|null; phoneVerified:boolean};
};
function applicantSession(){
  const raw=localStorage.getItem('asp_user'),token=localStorage.getItem('asp_astrologer_access_token');
  let user;try{user=JSON.parse(raw||'{}');}catch{throw Error('Sign in through Astrologer Login.');}
  if(!token || user.portal!=='astrologer')throw Error('Sign in through Astrologer Login.');
  return {token,snapshot:JSON.stringify([raw,token])};
}
export async function applicationRequest(path:string,init:RequestInit={}){
  if(!['/astrologer/onboarding-status','/astrologer/application','/astrologer/application/documents','/astrologer/application/corrections'].includes(path))throw Error('Unsupported application action.');
  const owner=applicantSession();const headers=new Headers({Accept:'application/json',Authorization:`Bearer ${owner.token}`});
  if(init.body && !(init.body instanceof FormData))headers.set('Content-Type','application/json');
  const response=await fetch(publicAuthBase()+path,{...init,headers,credentials:'omit',cache:'no-store',signal:init.signal??AbortSignal.timeout(30000)});
  const value=await response.json().catch(()=>null);
  if(applicantSession().snapshot!==owner.snapshot)throw Error('Account changed. Reopen your application.');
  if(!response.ok || value?.success!==true){
    if(response.status===401||response.status===403)throw Error('This action is not authorized. Sign in with the correct account and complete the required verification.');
    if(response.status===409)throw Error('Your application changed. Reload its server status before retrying.');
    throw Error('The application change was not confirmed. Check server status before retrying.');
  }
  return value;
}
export async function readApplication(signal?:AbortSignal):Promise<ApplicationStatus>{
  const value=await applicationRequest('/astrologer/onboarding-status',{signal});
  const data=value.data;
  if(!data || !['PROFILE_COMPLETION','PENDING_REVIEW','APPROVED','REJECTED','NEEDS_CHANGES','SUSPENDED'].includes(data.status) || typeof data.user?.id!=='string' || typeof data.user.phoneVerified!=='boolean')throw Error('Application status could not be verified.');
  return data;
}
export async function uploadApplicationDocument(file:File,type:'identity'|'certificate'|'experience',consent:{accepted:boolean;countryCode:string}){
  if(!consent.accepted || !/^[A-Z]{2}$/.test(consent.countryCode))throw Error('Choose your country and give document-review consent before uploading.');
  if(!['application/pdf','image/png','image/jpeg'].includes(file.type)||file.size===0||file.size>10*1024*1024)throw Error('Choose a PDF, PNG or JPG document of 10 MB or smaller.');
  const form=new FormData();form.set('file',file);form.set('documentType',type);form.set('consentAccepted','true');form.set('countryCode',consent.countryCode);
  const value=await applicationRequest('/astrologer/application/documents',{method:'POST',body:form});
  const path=value.data?.path;
  if(typeof path!=='string'||path.includes('://')||path.split('/').length!==3||path.split('/')[1]!==type)throw Error('Private document reference could not be verified.');
  return {type,name:file.name,url:path};
}
