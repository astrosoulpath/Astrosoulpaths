jest.mock('./firebase-google-identity', () => ({ verifyFirebaseGoogleIdentity: jest.fn() }));
import { verifyFirebaseGoogleIdentity } from './firebase-google-identity';
import { establishContextSession, verifyContextSession, assertContextOwner, assertContextRole } from './context-session';

describe('prepared server-verified multi-context sessions (no live accounts)', () => {
  const priorKey = process.env.AUTH_CONTEXT_SESSION_KEY;
  const priorFile = process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
  const priorUid = process.env.ADMIN_ALLOWED_FIREBASE_UID;
  let users: any, identity: any, user: any;
  const token = () => 'fixture.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 3600 })).toString('base64url') + '.fixture';
  beforeEach(() => {
    delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
    process.env.AUTH_CONTEXT_SESSION_KEY = '12'.repeat(32);
    process.env.ADMIN_ALLOWED_FIREBASE_UID = 'approved-admin-fixture';
    identity = { uid: 'approved-admin-fixture', email: 'fixture@example.invalid', googleEmail: 'fixture@example.invalid',
      googleSubject: 'google-fixture', tokenGoogleSubjects: ['google-fixture'], firebaseUserDisabled: false,
      expiresAt:Math.floor(Date.now()/1000)+3600,signInProvider:'google.com' };
    user = { id: 'canonical-fixture', supabaseId: 'auth-fixture', email: identity.email, role: { name: 'ADMIN' }, isActive: true, isBlocked: false };
    users = { getUserByFirebaseUid: jest.fn(async () => user), getAdminByFirebaseUid: jest.fn(async () => user) };
    (verifyFirebaseGoogleIdentity as jest.Mock).mockReset().mockImplementation(async () => identity);
  });
  afterEach(() => {
    if(priorFile===undefined)delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;else process.env.AUTH_CONTEXT_SESSION_KEY_FILE=priorFile;
    jest.useRealTimers();
    if (priorKey === undefined) delete process.env.AUTH_CONTEXT_SESSION_KEY; else process.env.AUTH_CONTEXT_SESSION_KEY = priorKey;
    if (priorUid === undefined) delete process.env.ADMIN_ALLOWED_FIREBASE_UID; else process.env.ADMIN_ALLOWED_FIREBASE_UID = priorUid;
  });
  async function session(context: 'customer' | 'astrologer' | 'admin' = 'customer') {
    return establishContextSession(token(), context, users);
  }
  it('Admin identity may establish Customer scope without altering canonical role or ownership', async () => {
    const issued = await session();
    const proof = await verifyContextSession(issued.accessToken, 'customer', users);
    expect(proof.effectiveRole).toBe('CUSTOMER'); expect(proof.user.role.name).toBe('ADMIN');
    expect(proof.user.id).toBe('canonical-fixture');
    expect(() => assertContextOwner(proof, 'canonical-fixture')).not.toThrow();
  });
  it('approved Admin independently establishes Admin scope', async () => {
    const issued = await session('admin');
    const proof = await verifyContextSession(issued.accessToken, 'admin', users);
    expect(() => assertContextRole(proof, ['ADMIN'])).not.toThrow();
  });
  it('Customer-scoped Admin token cannot replay in Admin scope', async () => {
    const issued = await session();
    await expect(verifyContextSession(issued.accessToken, 'admin', users)).rejects.toThrow();
    const proof = await verifyContextSession(issued.accessToken, 'customer', users);
    expect(() => assertContextRole(proof, ['ADMIN'])).toThrow();
    expect(() => assertContextRole(proof, ['ASTROLOGER'])).toThrow();
  });
  it.each(['CUSTOMER', 'USER', 'ASTROLOGER'])('existing %s can use Customer scope, without elevated privileges', async role => {
    user.role.name = role;
    const issued = await session();
    const proof = await verifyContextSession(issued.accessToken, 'customer', users);
    expect(() => assertContextRole(proof, ['CUSTOMER'])).not.toThrow();
    expect(() => assertContextRole(proof, ['ADMIN', 'ASTROLOGER'])).toThrow();
  });
  it.each(['CUSTOMER', 'USER', 'ASTROLOGER'])('%s cannot establish Admin scope', async role => {
    user.role.name = role;
    await expect(session('admin')).rejects.toThrow();
  });
  it('wrong Admin UID fails even with a canonical Admin role', async () => {
    identity.uid = 'different-admin';
    await expect(session('admin')).rejects.toThrow();
    await expect(session('customer')).resolves.toMatchObject({authContext:'customer'});
  });
  it('raw Firebase credential is not an Admin context session', async () => {
    await expect(verifyContextSession(token(), 'admin', users)).rejects.toThrow();
  });
  it('approved astrologer capabilities are independent of the canonical role',async()=>{
    user.isAstrologer=true;user.astrologer={isApproved:true,isVerified:true};
    identity.uid='non-admin-existing-fixture';
    const issued=await session('astrologer');
    const proof=await verifyContextSession(issued.accessToken,'astrologer',users);
    expect(()=>assertContextRole(proof,['ASTROLOGER'])).not.toThrow();
    expect(()=>assertContextRole(proof,['ADMIN'])).toThrow();
  });
  it.each(['missing','pending','unverified'])('restricts %s astrologer to applicant scope',async reason=>{
    user.isAstrologer=true;user.astrologer=reason==='missing'?null:{isApproved:reason!=='pending',isVerified:reason!=='unverified'};
    const issued=await session('astrologer');const proof=await verifyContextSession(issued.accessToken,'astrologer',users);
    expect(proof.effectiveRole).toBe('ASTROLOGER_APPLICANT');
    expect(()=>assertContextRole(proof,['ASTROLOGER'])).toThrow();
  });
  it('verified password identity supports customer and linked same-UID admin contexts',async()=>{
    identity.signInProvider='password';identity.hasEmailPasswordProvider=true;identity.passwordEmail=identity.email;
    await expect(session()).resolves.toMatchObject({authContext:'customer'});
    await expect(session('admin')).resolves.toMatchObject({authContext:'admin'});
    identity.googleSubject='';
    await expect(session('admin')).rejects.toThrow();
    await expect(session()).resolves.toMatchObject({authContext:'customer'});
  });
  it('rejects password ownership mismatch and expired verified source claims',async()=>{
    identity.signInProvider='password';identity.hasEmailPasswordProvider=true;identity.passwordEmail='different@example.invalid';
    await expect(session()).rejects.toThrow();identity.passwordEmail=identity.email;identity.expiresAt=1;
    await expect(session()).rejects.toThrow();
  });
  it('forged request role/context is not a verified proof', () => {
    expect(() => assertContextRole({ context: 'admin', user, expiresAt: Date.now()/1000+100 } as any, ['ADMIN'])).toThrow();
  });
  it('missing key fails before Firebase or database lookup', async () => {
    delete process.env.AUTH_CONTEXT_SESSION_KEY;
    await expect(session()).rejects.toThrow('not configured');
    expect(verifyFirebaseGoogleIdentity).not.toHaveBeenCalled();
    expect(users.getUserByFirebaseUid).not.toHaveBeenCalled();
  });
  it('invalid/revoked/unverified Firebase credentials fail with no provisioning', async () => {
    (verifyFirebaseGoogleIdentity as jest.Mock).mockRejectedValue(new Error('synthetic-rejected'));
    await expect(session()).rejects.toThrow();
    expect(users.getUserByFirebaseUid).not.toHaveBeenCalled();
  });
  it.each(['disabled', 'google-email', 'google-subject'])('rejects Firebase %s mismatch', async reason => {
    if (reason === 'disabled') identity.firebaseUserDisabled = true;
    if (reason === 'google-email') identity.googleEmail = 'different@example.invalid';
    if (reason === 'google-subject') identity.tokenGoogleSubjects = ['different'];
    await expect(session()).rejects.toThrow();
  });
  it.each(['blocked', 'inactive', 'unmapped'])('rejects %s canonical account', async reason => {
    if (reason === 'blocked') user.isBlocked = true;
    if (reason === 'inactive') user.isActive = false;
    if (reason === 'unmapped') users.getUserByFirebaseUid.mockResolvedValue(null);
    await expect(session()).rejects.toThrow();
  });
  it('rechecks revocation on each use rather than trusting decryption', async () => {
    const issued = await session('admin');
    (verifyFirebaseGoogleIdentity as jest.Mock).mockRejectedValue(new Error('private-token-must-not-leak'));
    await expect(verifyContextSession(issued.accessToken, 'admin', users)).rejects.toThrow('Invalid or expired context session');
  });
  it('mapping reassignment cannot transfer a session to a different canonical owner', async () => {
    const issued = await session(); user.id = 'other-canonical';
    await expect(verifyContextSession(issued.accessToken, 'customer', users)).rejects.toThrow();
  });
  it('wallet/profile/consultation ownership is exact, including for canonical Admin Customer context', async () => {
    const issued = await session(); const proof = await verifyContextSession(issued.accessToken, 'customer', users);
    expect(() => assertContextOwner(proof, 'other-customer')).toThrow();
    expect(() => assertContextOwner(proof, 'canonical-fixture')).not.toThrow();
  });
  it('expires no later than source credential and rejects expired sessions', async () => {
    jest.useFakeTimers();
    const issued = await session(); expect(issued.expiresIn).toBe(900);
    jest.setSystemTime(Date.now() + 901000);
    await expect(verifyContextSession(issued.accessToken, 'customer', users)).rejects.toThrow();
  });
  it('authenticated encryption rejects tampering and hides source Firebase token', async () => {
    const source = token(); const issued = await establishContextSession(source, 'customer', users);
    expect(issued.accessToken).not.toContain(source);
    const parts = issued.accessToken.split('.'); parts[3] = 'A' + parts[3].slice(1);
    await expect(verifyContextSession(parts.join('.'), 'customer', users)).rejects.toThrow();
  });
  it('concurrent Customer/Admin sessions remain separate and key rotation invalidates both', async () => {
    const [customer, admin] = await Promise.all([session(), session('admin')]);
    expect(customer.accessToken).not.toBe(admin.accessToken);
    await expect(verifyContextSession(admin.accessToken, 'customer', users)).rejects.toThrow();
    process.env.AUTH_CONTEXT_SESSION_KEY = '34'.repeat(32);
    await expect(verifyContextSession(customer.accessToken, 'customer', users)).rejects.toThrow();
    await expect(verifyContextSession(admin.accessToken, 'admin', users)).rejects.toThrow();
  });
});
