import {
  ownsKycDocument,
  validateKycFile,
  hasOwnedIdentityProof,
} from './kyc-document-policy';
import { AstrologerService } from './astrologer.service';
import { AdminService } from '../admin/admin.service';

describe('KYC file content, ownership and private link boundaries', () => {
  const pdf = Buffer.from('%PDF-1.7\nsynthetic document');
  const file = (buffer: Buffer = pdf, mimetype = 'application/pdf') => ({
    buffer,
    size: buffer.length,
    mimetype,
    originalname: 'synthetic.pdf',
  });
  it.each(['owner/identity/proof.pdf', 'owner/identity/historical-proof.jpg'])(
    'accepts canonical historical references: %s',
    (path) => {
      expect(ownsKycDocument(path, 'owner', 'identity')).toBe(true);
    },
  );
  it.each([
    'foreign/identity/proof.pdf',
    'owner/certificate/proof.pdf',
    'owner/identity/../proof.pdf',
    'https://host/proof.pdf',
    'owner/identity/%2e%2e.pdf',
    'owner/identity/proof.exe',
  ])('rejects foreign/unsafe document reference: %s', (path) => {
    expect(ownsKycDocument(path, 'owner', 'identity')).toBe(false);
  });
  it('verification requires an owned typed identity proof, not a URL-shaped claim', () => {
    expect(
      hasOwnedIdentityProof(
        {
          identityProof: {
            type: 'identity',
            name: 'proof',
            url: 'owner/identity/proof.pdf',
          },
        },
        'owner',
      ),
    ).toBe(true);
    expect(hasOwnedIdentityProof(null, 'owner')).toBe(false);
    expect(
      hasOwnedIdentityProof(
        {
          identityProof: {
            type: 'identity',
            name: 'proof',
            url: 'foreign/identity/proof.pdf',
          },
        },
        'owner',
      ),
    ).toBe(false);
  });
  it.each([
    [pdf, 'application/pdf'],
    [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
    [Buffer.from([255, 216, 255, 224]), 'image/jpeg'],
  ])('allows supported matching signatures (%s)', (bytes, mime) => {
    expect(() =>
      validateKycFile(file(bytes as Buffer, mime as string)),
    ).not.toThrow();
  });
  it.each([
    {
      buffer: Buffer.from('<script>synthetic</script>'),
      mimetype: 'application/pdf',
    },
    { buffer: pdf, mimetype: 'image/png' },
    { buffer: Buffer.alloc(0), mimetype: 'application/pdf' },
  ])('rejects spoofed/truncated/empty content', (value) => {
    expect(() => validateKycFile(file(value.buffer, value.mimetype))).toThrow();
  });
  it('rejects falsified sizes and over-limit payloads', () => {
    expect(() => validateKycFile({ ...file(), size: 1 })).toThrow();
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    expect(() => validateKycFile(file(big))).toThrow();
  });
  function fixture() {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const sign = jest
      .fn()
      .mockResolvedValue({
        data: { signedUrl: 'synthetic-private-link' },
        error: null,
      });
    const bucket = jest.fn().mockReturnValue({ upload, createSignedUrl: sign });
    const storage = { getStorageClient: () => ({ storage: { from: bucket } }) };
    const db = {
      userAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'owner' }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'owner', isActive: true, isBlocked: false }),
      },
    };
    const applicant = new AstrologerService(
      db as never,
      storage as never,
      {} as never,
    );
    const repo = {
      findAstrologerById: jest
        .fn()
        .mockResolvedValue({
          id: 'profile',
          userId: 'owner',
          documents: {
            identityProof: {
              type: 'identity',
              name: 'synthetic.pdf',
              url: 'owner/identity/historical.pdf',
            },
          },
        }),
    };
    const admin = new AdminService(
      repo as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { db, upload, sign, bucket, applicant, repo, admin };
  }
  it('valid upload uses canonical private namespace without overwriting an object', async () => {
    const f = fixture();
    const result = await f.applicant.uploadKycDocument(
      'subject',
      file() as never,
      'identity',
    );
    expect(result.data.path).toMatch(/^owner\/identity\/[0-9a-f-]+\.pdf$/);
    expect(f.upload).toHaveBeenCalledWith(
      result.data.path,
      pdf,
      expect.objectContaining({ upsert: false }),
    );
    expect(f.bucket).toHaveBeenCalledWith('astrologer-kyc');
  });
  it('spoofed content is rejected before storage or identity lookup', async () => {
    const f = fixture();
    await expect(
      f.applicant.uploadKycDocument(
        'subject',
        file(Buffer.from('not pdf')) as never,
        'identity',
      ),
    ).rejects.toThrow('content');
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.db.user.findUnique).not.toHaveBeenCalled();
  });
  it('blocked user cannot upload a document', async () => {
    const f = fixture();
    f.db.user.findUnique.mockResolvedValue({
      id: 'owner',
      isActive: true,
      isBlocked: true,
    });
    await expect(
      f.applicant.uploadKycDocument('subject', file() as never, 'identity'),
    ).rejects.toThrow('active account');
    expect(f.upload).not.toHaveBeenCalled();
  });
  it('signs legitimate historical owned documents with bounded expiry', async () => {
    const f = fixture();
    expect(
      (await f.admin.getAstrologerKyc('profile')).data.identityProof?.signedUrl,
    ).toBe('synthetic-private-link');
    expect(f.sign).toHaveBeenCalledWith('owner/identity/historical.pdf', 600);
  });
  it('never signs a stored foreign document reference', async () => {
    const f = fixture();
    f.repo.findAstrologerById.mockResolvedValue({
      id: 'profile',
      userId: 'owner',
      documents: {
        identityProof: {
          type: 'identity',
          name: 'foreign.pdf',
          url: 'other/identity/proof.pdf',
        },
      },
    });
    const result = await f.admin.getAstrologerKyc('profile');
    expect(result.data.identityProof?.signedUrl).toBeNull();
    expect(f.sign).not.toHaveBeenCalled();
  });
  it('does not return raw storage exception metadata', async () => {
    const f = fixture();
    f.upload.mockResolvedValue({
      error: { message: 'private synthetic provider details' },
    });
    await expect(
      f.applicant.uploadKycDocument('subject', file() as never, 'identity'),
    ).rejects.toThrow('Unable to upload');
    f.sign.mockResolvedValue({
      data: null,
      error: { message: 'private synthetic provider details' },
    });
    expect(
      JSON.stringify(await f.admin.getAstrologerKyc('profile')),
    ).not.toContain('private synthetic');
  });
});
