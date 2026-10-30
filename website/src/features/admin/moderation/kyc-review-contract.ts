export type ReviewDocument = {type?:string;name?:string;signedUrl?:string|null;error?:string};
export function privateKycLink(value:unknown):string|null {
  try { const url=new URL(String(value)); return url.protocol==='https:'&&!url.username&&!url.password?url.href:null; } catch { return null; }
}
export function readKycReview(value:unknown,astrologerId:string,now=Date.now()) {
  const result=value as {success?:unknown;data?:Record<string,unknown>};
  const data=result?.data;
  if(result?.success!==true||!data||data.astrologerId!==astrologerId)throw Error('KYC response does not match this astrologer.');
  const seconds=data.expiresInSeconds;
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0||seconds>600)throw Error('Private link expiry could not be verified.');
  const expiry=data.expiresAt===undefined?now+seconds*1000:Date.parse(String(data.expiresAt));
  if(!Number.isFinite(expiry)||expiry<=now||expiry>now+600000)throw Error('Private links have expired. Inspect the documents again.');
  if(!Array.isArray(data.certificates)||!Array.isArray(data.experienceProofs))throw Error('KYC response could not be verified.');
  const documents=[data.identityProof,...data.certificates,...data.experienceProofs].filter(Boolean);
  if(documents.some(d=>typeof d!=='object'||Array.isArray(d)))throw Error('KYC response could not be verified.');
  return {documents:documents as ReviewDocument[],expiresAt:expiry};
}
