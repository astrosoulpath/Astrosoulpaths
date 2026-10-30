import { AstrologerService } from './astrologer.service';
import { AdminRepository } from '../admin/admin.repository';
import { RolesGuard } from '../../common/guards/roles.guard';
// Unit tests verify canonical guards, not the live Firebase SDK/provider.
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Astrologer approval and application boundaries', () => {
  let db: any, service: AstrologerService;
  const account = { id: 'customer', phone: '+919876543210', email: 'customer@example.invalid',
    isActive: true, isBlocked: false, isAstrologer: false, astrologer: null };
  const application = { fullName: 'Applicant', email: account.email, phoneNumber: account.phone,
    languages: ['English'], expertise: ['Vedic'], experienceYears: 1, consultationPrice: 10,
    documents: { identityProof: { type: 'identity', name: 'proof.pdf', url: 'customer/identity/proof.pdf' } } };
  beforeEach(() => {
    db = { userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue({ id: 'verified' }) },
      user: { findUnique: jest.fn().mockResolvedValue(account), update: jest.fn() },
      astrologer: { findUnique: jest.fn().mockResolvedValue({ id: 'profile', userId: 'customer', isApproved: false, isVerified: false }),
        create: jest.fn().mockResolvedValue({ id: 'profile' }), update: jest.fn().mockResolvedValue({ userId: 'customer' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'profile' }) },
      astrologerQualificationSettings: { findUnique: jest.fn().mockResolvedValue({ isEnabled: false }) },
      expertise: { upsert: jest.fn().mockResolvedValue({ id: 'expertise' }) },
      astrologerEarning: { aggregate: jest.fn() }, $transaction: jest.fn() };
    db.$transaction.mockImplementation((fn: any) => fn(db));
    service = new AstrologerService(db, {getStorageClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from:()=>({exists:async()=>({data:true})})}})} as any, {} as any);
  });
  it.each(['getDashboard', 'getEarningsSummary', 'getPayoutBankAccount', 'getAvailability'])('blocks pending application on %s before operations', async (name) => {
    await expect((service as any)[name]('subject')).rejects.toThrow('Admin approval');
    expect(db.astrologerEarning.aggregate).not.toHaveBeenCalled();
  });
  it('allows legitimate applicants to inspect application status', async () => {
    expect((await service.getOnboardingStatus('subject')).data.nextStep).toBe('REGISTER');
  });
  it('requires both approval and verification, not just isAstrologer', async () => {
    db.user.findUnique.mockResolvedValue({ ...account, isAstrologer: true });
    db.astrologer.findUnique.mockResolvedValue({ isApproved: true, isVerified: false });
    await expect(service.getDashboard('subject')).rejects.toThrow('Admin approval');
  });
  it('creates only an application for the original customer and preserves identity fields', async () => {
    await service.register('subject', application);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'customer' }, data: { name: 'Applicant', isAstrologer: false } });
    expect(db.astrologer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      userId: 'customer', isApproved: false, isVerified: false,
    }) }));
  });
  it.each([{ email: 'foreign@example.invalid' }, { phoneNumber: '+911111111111' }])('rejects unverified form identity changes: %j', async (change) => {
    await expect(service.register('subject', { ...application, ...change })).rejects.toThrow();
    expect(db.user.update).not.toHaveBeenCalled(); expect(db.astrologer.create).not.toHaveBeenCalled();
  });
  it('rejects a profile-only phone even if the form matches it', async () => {
    db.userAuthIdentity.findFirst.mockResolvedValue(null);
    await expect(service.register('subject', application)).rejects.toThrow('Verify');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('permits a phone-only customer application without inventing a canonical email', async () => {
    db.user.findUnique.mockResolvedValue({ ...account, email: null });
    await service.register('subject', { ...application, email: undefined });
    expect(db.user.update.mock.calls[0][0].data.email).toBeUndefined();
  });
  it.each(['approveAstrologer', 'rejectAstrologer'])('%s preserves the permanent customer role', async (method) => {
    await (new AdminRepository(db) as any)[method]('profile');
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'customer' }, data: { isAstrologer: method === 'approveAstrologer' } });
  });
});

describe('Dual capability authorization without schema changes', () => {
  const context: any = { getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'verified-subject' } }) }) };
  const check = (required: string, overrides: any = {}) => {
    const reflector: any = { getAllAndOverride: (key: string) => key === 'roles' ? [required] : false };
    const db: any = { userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, isBlocked: false, roleId: 'role',
        role: { id: 'role', name: 'CUSTOMER' }, isAstrologer: true,
        astrologer: { isApproved: true, isVerified: true }, ...overrides }) } };
    return new RolesGuard(reflector, db).canActivate(context);
  };
  it('approved customer can use astrologer capability', async () => expect(await check('astrologer')).toBe(true));
  it('historically promoted astrologer retains customer access', async () => expect(await check('user', { role: { name: 'astrologer' } })).toBe(true));
  it('pending astrologer role cannot grant operational access', async () => {
    await expect(check('astrologer', { role: { name: 'astrologer' }, astrologer: { isApproved: false, isVerified: false } })).rejects.toThrow();
  });
  it('duplicate astrologer role identifiers cannot bypass pending approval', async () => {
    await expect(check('astrologer', { roleId: 'ASTROLOGER', role: { id: 'ASTROLOGER', name: 'astrologer' },
      astrologer: { isApproved: false, isVerified: false } })).rejects.toThrow();
  });
  it('customer capability cannot grant admin access', async () => { await expect(check('admin')).rejects.toThrow(); });
  it('blocked approved user cannot grant astrologer access', async () => { await expect(check('astrologer', { isBlocked: true })).rejects.toThrow(); });
});
