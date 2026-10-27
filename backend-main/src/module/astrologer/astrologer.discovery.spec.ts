import type { Prisma } from '@prisma/client';
import { AstrologerService } from './astrologer.service';
describe('public discovery compatibility and security', () => {
  const row = {
    id: 'synthetic-astro',
    user: {
      id: 'synthetic-user',
      name: 'Synthetic Astrologer',
      avatarUrl: null,
    },
    isOnline: true,
    pricePerMin: 25,
    rating: 4.5,
    experience: 3,
    languages: ['English'],
    expertise: [{ expertise: { name: 'Career' } }],
    _count: { reviews: 2 },
    consultationCategories: ['career'],
    bio: 'Synthetic',
    Gender: 'OTHER',
    privateKyc: 'PRIVATE',
  };
  function setup() {
    const db = {
      astrologer: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(25),
        findFirst: jest.fn().mockResolvedValue(row),
      },
      callSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    return {
      db,
      service: new AstrologerService(db as never, {} as never, {} as never),
    };
  }
  it('legacy Flutter list stays bounded and avoids an added count requirement', async () => {
    const { db, service } = setup();
    const r = await service.getPublicAstrologers();
    expect(
      (
        db.astrologer.findMany.mock.calls as unknown as [
          Prisma.AstrologerFindManyArgs,
        ][]
      )[0][0].take,
    ).toBe(100);
    expect(db.astrologer.count).not.toHaveBeenCalled();
    expect(r.meta.total).toBe(1);
  });
  it('paginates and sorts on the server with all eligibility filters intact', async () => {
    const { db, service } = setup();
    const r = await service.getPublicAstrologers({
      page: 2,
      limit: 12,
      sort: 'price-low',
      search: 'career',
      online: true,
    });
    const q = (
      db.astrologer.findMany.mock.calls as unknown as [
        Prisma.AstrologerFindManyArgs,
      ][]
    )[0][0];
    expect(q.skip).toBe(12);
    expect(q.take).toBe(12);
    expect(q.where).toMatchObject({
      isApproved: true,
      isVerified: true,
      isOnline: true,
      user: { is: { isActive: true, isBlocked: false, isAstrologer: true } },
    });
    expect(
      (q.orderBy as Prisma.AstrologerOrderByWithRelationInput[])[0],
    ).toEqual({ pricePerMin: 'asc' });
    expect(db.astrologer.count).toHaveBeenCalledWith({ where: q.where });
    expect(r.meta.total).toBe(25);
  });
  it.each([
    { page: 0 },
    { limit: 51 },
    { sort: 'private' },
    { search: 'x'.repeat(121) },
  ])('rejects invalid pagination/filter input %p', async (filters) => {
    const { service, db } = setup();
    await expect(service.getPublicAstrologers(filters)).rejects.toThrow();
    expect(db.astrologer.findMany).not.toHaveBeenCalled();
  });
  it('projects actual count/rate/busy state without leaking KYC data', async () => {
    const { db, service } = setup();
    db.callSession.findMany.mockResolvedValue([
      { astrologerId: row.user.id, expiresAt: new Date(Date.now() + 60000) },
    ] as never);
    const r = await service.getPublicAstrologers();
    expect(r.data[0]).toMatchObject({
      isBusy: true,
      isVerified: true,
      reviewCount: 2,
      currency: 'INR',
      billingUnit: 'minute',
    });
    expect(r.data[0]).not.toHaveProperty('privateKyc');
  });
  it('profile uses the same eligibility checks and safe projection', async () => {
    const { db, service } = setup();
    const r = await service.getPublicAstrologerById(row.id);
    expect(
      (
        db.astrologer.findFirst.mock.calls as unknown as [
          Prisma.AstrologerFindFirstArgs,
        ][]
      )[0][0].where,
    ).toMatchObject({
      isApproved: true,
      isVerified: true,
      user: { is: { isActive: true, isBlocked: false, isAstrologer: true } },
    });
    expect(r.data.reviewCount).toBe(2);
    expect(r.data).not.toHaveProperty('privateKyc');
  });
});
