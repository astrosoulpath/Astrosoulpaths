import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { verifyFirebaseGoogleIdentity } from './firebase-google-identity';
import { authorizeAdminIdentity } from './admin-identity-policy';
import type { UserService } from '../../module/user/user.service';

export type AuthContext = 'customer' | 'astrologer' | 'admin';
type Users = Pick<UserService, 'getUserByFirebaseUid' | 'getAdminByFirebaseUid'>;
type User = NonNullable<Awaited<ReturnType<Users['getUserByFirebaseUid']>>>;
export type ContextProof = Readonly<{
  context: AuthContext; user: User; uid: string; expiresAt: number; canonicalUserId:string;
  effectiveRole: 'CUSTOMER' | 'ASTROLOGER' | 'ASTROLOGER_APPLICANT' | 'ADMIN';
}>;
const proofs = new WeakSet<object>();
const issuer = 'astro-soul-path/auth-context/v1';
const prefix = 'aspctx.';
const ttl = 900;
export function assertContextConfigured(){ key(); }

function key(): Uint8Array {
  let secret = process.env.AUTH_CONTEXT_SESSION_KEY;
  const file = process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
  if (file) {
    if (secret || !isAbsolute(file)) throw new ServiceUnavailableException('Ambiguous context key configuration');
    try { const stat=lstatSync(file); if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128)throw Error(); secret=readFileSync(file,'utf8').trim(); }
    catch { throw new ServiceUnavailableException('Context key file is unavailable'); }
  }
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new ServiceUnavailableException('Context sessions are not configured');
  }
  return Buffer.from(secret, 'hex');
}

async function resolve(idToken: string, context: AuthContext, users: Users) {
  const identity = await verifyFirebaseGoogleIdentity(idToken, false, true);
  if (identity.firebaseUserDisabled || (identity.signInProvider === 'password'
      ? !identity.hasEmailPasswordProvider || identity.passwordEmail !== identity.email
      : identity.googleEmail !== identity.email || !identity.tokenGoogleSubjects?.includes(identity.googleSubject))) {
    throw new UnauthorizedException('Verified Firebase identity required');
  }
  const user = await users.getUserByFirebaseUid(identity.uid);
  if (!user || !user.isActive || user.isBlocked || !user.supabaseId ||
      user.email?.trim().toLowerCase() !== identity.email) {
    throw new UnauthorizedException('Existing active canonical identity required');
  }
  const role = user.role?.name?.trim().toUpperCase();
  if (!['ADMIN', 'USER', 'CUSTOMER', 'ASTROLOGER'].includes(role ?? '')) {
    throw new ForbiddenException('Account context is not authorized');
  }
  if (context === 'admin') {
    const admin = await authorizeAdminIdentity(identity, users);
    if (admin.id !== user.id) throw new UnauthorizedException('Canonical identity conflict');
  }
  return { identity, user };
}

/** No provisioning, linking, role changes or mutable account synchronization. */
export async function establishContextSession(idToken: string, context: AuthContext, users: Users) {
  const secret = key(); // Missing configuration fails before any identity lookup.
  if (!['customer', 'astrologer', 'admin'].includes(context)) throw new ForbiddenException('Invalid context');
  const { identity, user } = await resolve(idToken, context, users);
  const now = Math.floor(Date.now() / 1000);
  // This claim is consumed only after the Firebase SDK verified the source token.
  const sourceExpiry = identity.expiresAt;
  if (!Number.isSafeInteger(sourceExpiry) || sourceExpiry <= now) throw new UnauthorizedException('Firebase session expired');
  const exp = Math.min(now + ttl, sourceExpiry);
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);
  cipher.setAAD(Buffer.from(issuer));
  const body=JSON.stringify({ctx:context,iss:issuer,aud:`asp:${context}`,sub:user.id,iat:now,exp,jti:randomUUID(),firebaseToken:idToken,firebaseUid:identity.uid});
  const encrypted=Buffer.concat([cipher.update(body,'utf8'),cipher.final()]);
  const accessToken=prefix+'v1.'+[iv,encrypted,cipher.getAuthTag()].map(x=>x.toString('base64url')).join('.');
  if (accessToken.length > 3800) throw new ServiceUnavailableException('Context credential exceeds cookie budget');
  return { accessToken, expiresIn: exp - now, expiresAt: exp, authProvider: 'asp-context', authContext: context, firebaseUid:identity.uid };
}

export async function verifyContextSession(token: string, context: AuthContext, users: Users): Promise<ContextProof> {
  const secret = key();
  try {
    if (!['customer', 'astrologer', 'admin'].includes(context) || typeof token !== 'string' ||
        !token.startsWith(prefix) || token.length > 3800) throw new Error();
    const parts=token.split('.');
    if(parts.length!==5||parts[1]!=='v1'||!parts.slice(2).every(x=>/^[A-Za-z0-9_-]+$/.test(x)))throw Error();
    const [iv,encrypted,tag]=parts.slice(2).map(x=>Buffer.from(x,'base64url'));
    if(iv.length!==12||tag.length!==16)throw Error();
    const decipher=createDecipheriv('aes-256-gcm',secret,iv);decipher.setAAD(Buffer.from(issuer));decipher.setAuthTag(tag);
    const payload=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8'));
    const now=Math.floor(Date.now()/1000);
    if (payload.iss!==issuer||payload.aud!==`asp:${context}`||typeof payload.sub!=='string'||typeof payload.jti!=='string'||payload.ctx !== context ||
        typeof payload.firebaseToken !== 'string' || typeof payload.firebaseUid !== 'string' ||
        !Number.isSafeInteger(payload.exp)||!Number.isSafeInteger(payload.iat)||payload.iat>now||payload.exp<=now||payload.exp<=payload.iat||payload.exp-payload.iat>ttl) throw new Error();
    // Recheck revocation, provider, canonical mapping, activity and Admin allowlist
    // for every request. Decryption alone never authorizes an account.
    const { identity, user } = await resolve(payload.firebaseToken, context, users);
    if (identity.uid !== payload.firebaseUid || user.id !== payload.sub) throw new Error();
    const approved=!!(user.isAstrologer&&user.astrologer?.isApproved&&user.astrologer?.isVerified);
    const proof: ContextProof = Object.freeze({ context, user, uid: identity.uid,canonicalUserId:user.id,
      expiresAt: payload.exp, effectiveRole: context === 'customer' ? 'CUSTOMER' : context==='admin'?'ADMIN':approved?'ASTROLOGER':'ASTROLOGER_APPLICANT' });
    proofs.add(proof);
    return proof;
  } catch {
    throw new UnauthorizedException('Invalid or expired context session');
  }
}

export function assertContextRole(proof: ContextProof, roles: string[]) {
  if (!proofs.has(proof) || proof.expiresAt <= Date.now() / 1000) throw new UnauthorizedException('Verified context required');
  const effective = proof.context === 'customer' ? ['USER', 'CUSTOMER'] : [proof.effectiveRole];
  if (!roles.some(role => effective.includes(role.toUpperCase()))) throw new ForbiddenException('Context permission denied');
}

export async function verifyAnyContextSession(token:string,users:Users){
  for(const context of ['customer','astrologer','admin'] as const){try{return await verifyContextSession(token,context,users);}catch{}}
  throw new UnauthorizedException('Invalid or expired context session');
}

/** Read-only adapter avoids a DI cycle between shared auth and UserService. */
export function contextIdentityReader(db:any):Users {
  const include={role:true,subscriptionPlan:true,astrologer:true,userProfile:true};
  return {
    getUserByFirebaseUid:async(uid:string)=>{const row=await db.userAuthIdentity.findUnique({where:{provider_providerUserId:{provider:'firebase',providerUserId:uid}},include:{user:{include}}});return row?.user??null;},
    getAdminByFirebaseUid:async(uid:string)=>{const row=await db.userAuthIdentity.findUnique({where:{provider_providerUserId:{provider:'firebase',providerUserId:uid}},include:{user:{include}}});return row?.identityType==='google'&&row.email?.trim().toLowerCase()===row.user?.email?.trim().toLowerCase()?row.user:null;},
  };
}

export function assertContextOwner(proof: ContextProof, ownerId: string) {
  assertContextRole(proof, ['CUSTOMER']);
  if (proof.canonicalUserId !== ownerId) throw new ForbiddenException('Customer ownership required');
}
