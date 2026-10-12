jest.mock('firebase-admin/app', () => ({ cert: jest.fn(), getApps: jest.fn(() => []), initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { getAuth } from 'firebase-admin/auth';
import { UserService } from './user.service';

describe('Canonical identity safety', () => {
  const legacyId = '11111111-1111-4111-8111-111111111111';
  const phone = '+919876543210';
  const canonical = { id: 'original', supabaseId: legacyId, email: 'owner@example.invalid',
    phone, isActive: true, isBlocked: false, role: { name: 'CUSTOMER' },
    authIdentities: [], isAstrologer: false, astrologer: null };
  let db: any, supabase: any, service: UserService;
  beforeEach(() => {
    db = { user: { findUnique: jest.fn().mockResolvedValue(canonical), update: jest.fn(), create: jest.fn() },
      userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
      userProfile: { updateMany: jest.fn() }, wallet: { update: jest.fn() },
      subscription: { update: jest.fn() }, $transaction: jest.fn() };
    db.$transaction.mockImplementation((fn: any) => fn(db));
    supabase = { hasAdminClient: jest.fn().mockReturnValue(true),
      getStorageClient: () => ({ auth: { admin: { getUserById: supabase.getUserById } } }),
      getUserById: jest.fn().mockResolvedValue({ data: { user: {
        id: legacyId, email: canonical.email,
        identities: [{ provider: 'google', identity_data: { sub: 'verified-google-subject' } }],
      } }, error: null }) };
    service = new UserService(db, supabase);
  });
  it('new Google login creates one canonical user and repeat login reuses it without a wallet write', async () => {
    let created: any = null, mapping: any = null;
    db.role = { findUnique: jest.fn().mockResolvedValue({ id: 'customer-role' }) };
    db.subscriptionPlan = { findUnique: jest.fn().mockResolvedValue({ id: 'free-plan' }) };
    db.user.findUnique.mockImplementation(({ where }: any) => where.email ? created : created);
    db.user.create.mockImplementation(({ data }: any) => { created = { ...data, id: 'new-canonical', isActive: true, isBlocked: false }; return created; });
    db.userAuthIdentity.findUnique.mockImplementation(() => mapping);
    db.userAuthIdentity.create.mockImplementation(({ data }: any) => { mapping = { ...data, id: 'new-mapping' }; return mapping; });
    const first = await service.syncFirebaseEmailUser({ firebaseUid: 'new-google-uid', email: 'new@example.invalid', identityType: 'google' });
    const second = await service.syncFirebaseEmailUser({ firebaseUid: 'new-google-uid', email: 'new@example.invalid', identityType: 'google' });
    expect(first.user.id).toBe('new-canonical'); expect(first.isNewUser).toBe(true);
    expect(second.user.id).toBe(first.user.id); expect(second.isNewUser).toBe(false);
    expect(db.user.create).toHaveBeenCalledTimes(1); expect(db.userAuthIdentity.create).toHaveBeenCalledTimes(1);
    expect(db.wallet.update).not.toHaveBeenCalled();
  });
  it('recovers the same legacy Google subject and persists the original canonical ID', async () => {
    await expect(service.recoverLegacyFirebaseGoogleIdentity('firebase-google', canonical.email, 'verified-google-subject')).resolves.toBe(true);
    expect(db.userAuthIdentity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: canonical.id, providerUserId: 'firebase-google', provider: 'firebase' }),
    }));
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.wallet.update).not.toHaveBeenCalled();
    expect(db.subscription.update).not.toHaveBeenCalled();
  });
  it.each(['different-subject', ''])('does not recover on email alone or mismatched subject: %s', async (sub) => {
    await expect(service.recoverLegacyFirebaseGoogleIdentity('firebase-google', canonical.email, sub)).resolves.toBe(false);
    expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
  });
  it('does not classify an email/password identity as legacy Google', async () => {
    supabase.getUserById.mockResolvedValue({ data: { user: { id: legacyId, email: canonical.email,
      identities: [{ provider: 'email', identity_data: { sub: 'verified-google-subject' } }] } } });
    expect(await service.recoverLegacyFirebaseGoogleIdentity('firebase-google', canonical.email, 'verified-google-subject')).toBe(false);
    expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
  });
  it('fails closed when legacy admin verification is unavailable', async () => {
    supabase.hasAdminClient.mockReturnValue(false);
    expect(await service.recoverLegacyFirebaseGoogleIdentity('uid', canonical.email, 'subject')).toBe(false);
    expect(supabase.getUserById).not.toHaveBeenCalled();
  });
  it('never reassigns a Firebase identity already owned by another account', async () => {
    db.userAuthIdentity.findUnique.mockImplementation(({ where }: any) =>
      where.provider_providerUserId.provider === 'firebase' ? { id: 'foreign', userId: 'other' } : null);
    await expect(service.linkFirebaseGoogleIdentityToLegacyAccount('uid', canonical.email, legacyId)).rejects.toMatchObject({
      response: { code: 'FIREBASE_GOOGLE_LINK_MANUAL_REVIEW' },
    });
    expect(db.userAuthIdentity.update).not.toHaveBeenCalled();
    expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
  });
  it('repairs a missing mapping only when the stored Firebase UID proves canonical ownership', async () => {
    db.user.findUnique.mockResolvedValue({ ...canonical, supabaseId: 'firebase:verified-uid' });
    const result = await service.syncFirebaseEmailUser({ firebaseUid: 'verified-uid', email: canonical.email, identityType: 'google' });
    expect(result.user.id).toBe('original');
    expect(db.userAuthIdentity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'original', providerUserId: 'verified-uid' }),
    }));
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.wallet.update).not.toHaveBeenCalled();
  });
  it('does not repair a different Firebase UID by matching email', async () => {
    db.user.findUnique.mockResolvedValue({ ...canonical, supabaseId: 'firebase:original-uid' });
    await expect(service.syncFirebaseEmailUser({ firebaseUid: 'foreign-uid', email: canonical.email, identityType: 'google' })).rejects.toMatchObject({
      response: { code: 'FIREBASE_GOOGLE_LINK_REQUIRED' },
    });
    expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
  });
  it('verified Firebase UID can restore its own phone mapping without trusting a phone collision', async () => {
    db.user.findUnique.mockResolvedValue({ ...canonical, supabaseId: 'firebase:original-uid' });
    const result = await service.syncFirebasePhoneUser({ firebaseUid: 'original-uid', phone });
    expect(result.user.id).toBe('original');
    expect(db.userAuthIdentity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'original', identityType: 'phone', phone }),
    }));
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('rejects phone collision with an unverified profile phone', async () => {
    await expect(service.syncFirebasePhoneUser({ firebaseUid: 'new-phone-uid', phone })).rejects.toMatchObject({
      response: { code: 'PHONE_ACCOUNT_OWNERSHIP_REQUIRED' },
    });
    expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('reuses an established verified phone account without creating a user or wallet', async () => {
    db.userAuthIdentity.findFirst.mockResolvedValue({ id: 'verified' });
    const result = await service.syncFirebasePhoneUser({ firebaseUid: 'new-phone-uid', phone });
    expect(result.user.id).toBe('original');
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.wallet.update).not.toHaveBeenCalled();
  });
  it('explicit Google linking refuses a phone Firebase UID owned by another canonical user', async () => {
    jest.spyOn(service, 'verifyFirebaseProfilePhoneToken').mockResolvedValue({ phone, firebaseUid: 'phone-proof' });
    db.userAuthIdentity.findFirst.mockResolvedValue({ id: 'verified-phone' });
    db.userAuthIdentity.findUnique.mockImplementation(({ where }: any) =>
      where.provider_providerUserId.providerUserId === 'phone-proof' ? { userId: 'foreign' } : null);
    await expect(service.linkFirebaseGoogleIdentityToVerifiedPhone('google-proof', canonical.email, 'otp-token')).rejects.toThrow('another account');
    expect(db.userAuthIdentity.create).not.toHaveBeenCalled(); expect(db.userAuthIdentity.update).not.toHaveBeenCalled();
  });
  it('OTP attachment refuses another canonical phone owner even with a verified OTP', async () => {
    jest.spyOn(service, 'verifyFirebaseProfilePhoneToken').mockResolvedValue({ phone, firebaseUid: 'new-uid' });
    db.user.findUnique.mockImplementation(({ where }: any) => where.phone ? { id: 'other' } : canonical);
    await expect(service.attachVerifiedFirebasePhone(legacyId, 'otp-proof')).rejects.toMatchObject({
      response: { code: 'PHONE_ACCOUNT_OWNERSHIP_REQUIRED' },
    });
    expect(db.user.update).not.toHaveBeenCalled(); expect(db.userAuthIdentity.upsert).not.toHaveBeenCalled();
  });
  it('OTP attachment refuses a Firebase UID owned by another user', async () => {
    jest.spyOn(service, 'verifyFirebaseProfilePhoneToken').mockResolvedValue({ phone, firebaseUid: 'foreign' });
    db.userAuthIdentity.findUnique.mockImplementation(({ where }: any) =>
      where.provider_providerUserId.provider === 'firebase' ? { userId: 'other' } : null);
    await expect(service.attachVerifiedFirebasePhone(legacyId, 'otp-proof')).rejects.toThrow();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('attaches an OTP identity only to the authenticated canonical account', async () => {
    jest.spyOn(service, 'verifyFirebaseProfilePhoneToken').mockResolvedValue({ phone, firebaseUid: 'phone-uid' });
    expect((await service.attachVerifiedFirebasePhone(legacyId, 'otp-proof')).data.canonicalUserId).toBe('original');
    expect(db.userAuthIdentity.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: 'original', identityType: 'phone', phone }),
    }));
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('Google email alone does not make a phone verified or allow onboarding', async () => {
    const state = await service.getSessionState(legacyId, 'joinAstrologer');
    expect(state.user.isPhoneVerified).toBe(false);
    expect(state.nextStep).toBe('VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING');
  });
  it('pending approval is restored as an applicant, customer portal remains accessible', async () => {
    db.user.findUnique.mockResolvedValue({ ...canonical, isAstrologer: true,
      astrologer: { isApproved: false, isVerified: true } });
    expect((await service.getSessionState(legacyId, 'astrologer')).nextStep).toBe('WAIT_FOR_ADMIN_APPROVAL');
    expect((await service.getSessionState(legacyId, 'customer')).role).toBe('CUSTOMER');
  });
  it('approved capability restores astrologer access without changing the customer role', async () => {
    db.user.findUnique.mockResolvedValue({ ...canonical, isAstrologer: true,
      astrologer: { isApproved: true, isVerified: true } });
    const state = await service.getSessionState(legacyId, 'joinAstrologer');
    expect(state.portal).toBe('astrologer'); expect(state.nextStep).toBe('OPEN_ASTROLOGER_DASHBOARD');
    expect((await service.getSessionState(legacyId)).role).toBe('CUSTOMER');
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('invalid portal and blocked accounts cannot restore access', async () => {
    await expect(service.getSessionState(legacyId, 'admin')).rejects.toThrow();
    db.user.findUnique.mockResolvedValue({ ...canonical, isBlocked: true });
    await expect(service.getSessionState(legacyId)).rejects.toThrow();
  });
});

describe('Recent Firebase phone proof', () => {
  const previous = { FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY };
  beforeAll(() => Object.assign(process.env, { FIREBASE_PROJECT_ID: 'unit-test', FIREBASE_CLIENT_EMAIL: 'unit@example.invalid', FIREBASE_PRIVATE_KEY: 'unit-placeholder' }));
  afterAll(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  it.each([
    { provider: 'google.com', age: 0 }, { provider: 'phone', age: 601 },
    { provider: 'phone', age: -120 },
  ])('rejects email proof, stale OTP and future auth time: %j', async ({ provider, age }) => {
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue({
      aud: 'unit-test', uid: 'uid', phone_number: '+919876543210',
      firebase: { sign_in_provider: provider }, auth_time: Math.floor(Date.now() / 1000) - age,
    }) });
    await expect(new UserService({} as any, {} as any).verifyFirebaseProfilePhoneToken('token', true)).rejects.toThrow();
  });
});
