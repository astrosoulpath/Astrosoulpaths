import { AstrologerService } from './astrologer.service';

describe('Qualification scoring and canonical KYC registration', () => {
  let db: any;
  let service: AstrologerService;
  const user = { id: 'canonical', phone: '+919876543210', email: null,
    isActive: true, isBlocked: false, astrologer: null };
  const proof = { type: 'identity', name: 'proof.pdf', url: 'canonical/identity/proof.pdf' };
  const application = { fullName: 'Applicant', phoneNumber: user.phone,
    languages: ['English'], expertise: ['Vedic'], experienceYears: 1,
    consultationPrice: 10, documents: { identityProof: proof } };
  beforeEach(() => {
    db = {
      userAuthIdentity: { findUnique: jest.fn().mockResolvedValue({ userId: user.id }),
        findFirst: jest.fn().mockResolvedValue({ id: 'phone-proof' }) },
      user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
      astrologerQualificationSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      astrologerQualificationAttempt: { findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'pass', passed: true }),
        create: jest.fn().mockResolvedValue({ id: 'attempt' }) },
      astrologerQualificationQuestion: { findMany: jest.fn().mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, correctOption: 'A' }))) },
      expertise: { upsert: jest.fn().mockResolvedValue({ id: 'expertise' }) },
      astrologer: { create: jest.fn().mockResolvedValue({ id: 'profile' }) },
      $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((fn: any) => fn(db));
    service = new AstrologerService(db, {} as any, {} as any);
  });
  it.each([[7, true, 70], [6, false, 60]])('%i correct answers: passed=%s', async (correct, passed, score) => {
    const answers = Array.from({ length: 10 }, (_, i) => ({ questionId: `q${i}`,
      selectedOption: i < Number(correct) ? 'A' : 'B' }));
    const result = await service.submitQualification('subject', answers);
    expect(result.data).toEqual(expect.objectContaining({ passed, score, totalQuestions: 10, passingPercentage: 70 }));
    expect(db.astrologerQualificationAttempt.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: user.id, passed, score, totalQuestions: 10, passingScore: 70,
    }) });
  });
  it('blocks registration without a persisted qualification pass', async () => {
    db.astrologerQualificationAttempt.findFirst.mockResolvedValue(null);
    await expect(service.register('subject', application)).rejects.toThrow('must pass');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('requires identity proof', async () => {
    await expect(service.register('subject', { ...application, documents: undefined })).rejects.toThrow('Identity proof');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each(['foreign/identity/proof.pdf', 'canonical-other/identity/proof.pdf',
    'canonical/certificate/proof.pdf', 'canonical/identity/../proof.pdf',
    'canonical/identity/%2e%2e', 'canonical/identity/..',
    'https://example.invalid/proof.pdf', 'C:\\device\\proof.pdf',
    'canonical/identity/proof.pdf?x=1'])('rejects invalid ownership/reference: %s', async (url) => {
    await expect(service.register('subject', { ...application,
      documents: { identityProof: { ...proof, url } } })).rejects.toThrow('KYC storage path');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('validates ownership of optional certificates too', async () => {
    await expect(service.register('subject', { ...application, documents: {
      identityProof: proof, certificates: [{ type: 'certificate', name: 'cert.pdf', url: 'foreign/certificate/cert.pdf' }],
    } })).rejects.toThrow('KYC storage path');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects malformed identity metadata', async () => {
    await expect(service.register('subject', { ...application,
      documents: { identityProof: { ...proof, name: ' ' } } })).rejects.toThrow('metadata');
  });
  it('preserves valid uploaded metadata and creates only a pending canonical application', async () => {
    const documents = { identityProof: proof,
      certificates: [{ type: 'certificate', name: 'cert.pdf', url: 'canonical/certificate/cert.pdf' }],
      experienceProofs: [{ type: 'experience', name: 'work.png', url: 'canonical/experience/work.png' }] };
    await service.register('subject', { ...application, documents });
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id } }));
    expect(db.astrologer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      userId: user.id, documents, isApproved: false, isVerified: false, isOnline: false,
    }) }));
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: user.id }, data: { name: 'Applicant', isAstrologer: false } });
  });
});
