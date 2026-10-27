import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const BIRTH_SHARING_NOTICE = 'consultation-birth-sharing-v2';
export function sharedBirthDetails(p: any) {
  if (!p?.fullName?.trim() || !p.dateOfBirth || !p.timeOfBirth || !p.birthTimeKnown ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(p.timeOfBirth) ||
      !Number.isFinite(p.dateOfBirth.getTime()) || p.dateOfBirth > new Date() ||
      !(p.location || p.city)?.trim()) return null;
  return { fullName: p.fullName, dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
    timeOfBirth: p.timeOfBirth, birthPlace: [p.location || p.city, p.state, p.country].filter(Boolean).join(', '),
    gender: p.gender ?? null };
}
const version = (details: object) => createHash('sha256').update(JSON.stringify(details)).digest('hex');

@Injectable()
export class BirthSharingService {
  constructor(private readonly prisma: PrismaService) {}

  async access(actorId: string, consultationId: string, action: 'read' | 'grant' | 'revoke', notice?: unknown, reviewedVersion?: unknown, selectedProfile?: unknown, reviewedRevision?: unknown) {
    if (process.env.CONSULTATION_BIRTH_SHARING_ENABLED !== 'true')
      throw new ServiceUnavailableException('Birth sharing is not activated');
    if (!actorId || !consultationId || consultationId.length > 128) throw new ForbiddenException('Access denied');
    try { return await this.prisma.$transaction(async tx => {
      // All sharing reads and mutations serialize with consultation completion.
      await tx.$queryRaw`SELECT "id" FROM public."CallSession" WHERE "id"=${consultationId} FOR UPDATE`;
      const call = await tx.callSession.findUnique({ where: { id: consultationId } });
      if (!call || ![call.userId, call.astrologerId].includes(actorId)) throw new ForbiddenException('Access denied');
      const customer = actorId === call.userId;
      if (action !== 'read' && !customer) throw new ForbiddenException('Only the customer can change permission');
      await tx.$queryRaw`SELECT "id" FROM public."User" WHERE "id" IN (${call.userId},${call.astrologerId}) ORDER BY "id" FOR SHARE`;
      await tx.$queryRaw`SELECT "id" FROM public."Astrologer" WHERE "userId"=${call.astrologerId} FOR SHARE`;
      const accounts = await tx.user.findMany({ where: { id: { in: [call.userId, call.astrologerId] } },
        select: { id: true, name: true, isActive: true, isBlocked: true, role: { select: { name: true } } } });
      const astrologer = await tx.astrologer.findUnique({ where: { userId: call.astrologerId },
        select: { isApproved: true, isVerified: true } });
      if (accounts.length !== 2 || accounts.some(u => !u.isActive || u.isBlocked) ||
          !['CUSTOMER', 'USER'].includes(accounts.find(u => u.id === call.userId)?.role?.name?.toUpperCase() ?? '') ||
          accounts.find(u => u.id === call.astrologerId)?.role?.name?.toUpperCase() !== 'ASTROLOGER' ||
          !astrologer?.isApproved || !astrologer.isVerified) throw new ForbiddenException('Access denied');
      const now = new Date();
      const active = call.status === 'ACTIVE' && !call.endedAt && call.expiresAt > now &&
        ['chat', 'audio', 'video'].includes(call.mode);
      if (!active && action !== 'revoke') throw new ForbiddenException('Active consultation required');
      const entries = await tx.$queryRaw<any[]>`SELECT * FROM public."ConsultationBirthSharing" WHERE "consultationId"=${call.id} FOR UPDATE`;
      const consent = entries[0];
      if (consent && (consent.customerId !== call.userId || consent.astrologerId !== call.astrologerId))
        throw new ForbiddenException('Consent participant mismatch');
      if (action === 'revoke') {
        if (consent && !consent.revokedAt) {
          await tx.$executeRaw`UPDATE public."ConsultationBirthSharing" SET "revokedAt"=${now}, "revision"="revision"+1 WHERE "consultationId"=${call.id}`;
          await tx.$executeRaw`INSERT INTO public."ConsultationBirthSharingAudit" ("id","consultationId","actorId","action","policyVersion","profileRef","birthVersion","revision") VALUES (${randomUUID()},${call.id},${actorId},'REVOKE',${BIRTH_SHARING_NOTICE},${consent.profileRef},${consent.birthVersion},${consent.revision + 1})`;
        }
        return { state: 'REVOKED', isCustomer: customer, details: null };
      }
      // Do not even load protected fields for an astrologer without live consent.
      const valid = consent && !consent.revokedAt && consent.expiresAt > now &&
        consent.customerId === call.userId && consent.astrologerId === call.astrologerId &&
        consent.policyVersion === BIRTH_SHARING_NOTICE;
      if (!customer && !valid) return { state: 'NOT_SHARED', isCustomer: false, details: null };
      // Lists are customer-only. An astrologer can resolve only the consented profile.
      let options: { profileRef: string; label: string }[] | undefined;
      if (customer) {
        const primary = await tx.userProfile.findUnique({ where: { userId: call.userId }, select: { id: true, fullName: true } });
        const saved = await tx.profile.findMany({ where: { userId: call.userId, isDeleted: false }, select: { id: true, name: true }, orderBy: { id: 'asc' } });
        options = [...(primary ? [{ profileRef: `user:${primary.id}`, label: primary.fullName }] : []),
          ...saved.map(p => ({ profileRef: `saved:${p.id}`, label: p.name }))];
      }
      const profileRef = customer ? selectedProfile : consent.profileRef;
      if (customer && action === 'read' && selectedProfile === undefined) return {
        state: 'PROFILE_SELECTION_REQUIRED', isCustomer: true, details: null, profiles: options,
        canRevoke: !!consent && !consent.revokedAt,
        astrologerName: accounts.find(u => u.id === call.astrologerId)?.name ?? 'Assigned astrologer',
        revision: consent?.revision ?? 0, policyVersion: BIRTH_SHARING_NOTICE, expiresAt: call.expiresAt.toISOString(),
      };
      if (typeof profileRef !== 'string' || profileRef.length > 160 ||
          !/^(user|saved):[^:]+$/.test(profileRef) ||
          (customer && !options?.some(p => p.profileRef === profileRef))) throw new BadRequestException('Select an owned birth profile');
      const [source, profileId] = profileRef.split(':');
      let profile: any;
      if (source === 'user') {
        await tx.$queryRaw`SELECT "id" FROM public."UserProfile" WHERE "id"=${profileId} AND "userId"=${call.userId} FOR SHARE`;
        profile = await tx.userProfile.findFirst({ where: { id: profileId, userId: call.userId }, select: {
          fullName: true, dateOfBirth: true, timeOfBirth: true, birthTimeKnown: true,
          location: true, city: true, state: true, country: true, gender: true,
        } });
      } else {
        await tx.$queryRaw`SELECT "id" FROM public."Profile" WHERE "id"=${profileId} AND "userId"=${call.userId} FOR SHARE`;
        const saved = await tx.profile.findFirst({ where: { id: profileId, userId: call.userId, isDeleted: false }, select: {
          name: true, birthDate: true, birthTime: true, city: true, state: true, country: true, gender: true,
        } });
        profile = saved && { ...saved, fullName: saved.name, dateOfBirth: saved.birthDate, timeOfBirth: saved.birthTime, birthTimeKnown: true };
      }
      const details = sharedBirthDetails(profile);
      const fingerprint = details ? version({ profileRef, details }) : null;
      if (action === 'grant') {
        if (!Number.isSafeInteger(reviewedRevision) || reviewedRevision !== (consent?.revision ?? 0)) throw new BadRequestException('Refresh permission before sharing');
        if (notice !== BIRTH_SHARING_NOTICE || !details || reviewedVersion !== fingerprint) throw new BadRequestException('Review complete birth details and accept the current notice');
        if (!valid || consent.birthVersion !== fingerprint || consent.profileRef !== profileRef) {
          await tx.$executeRaw`INSERT INTO public."ConsultationBirthSharing" ("consultationId","customerId","astrologerId","profileRef","revision","birthVersion","policyVersion","expiresAt") VALUES (${call.id},${call.userId},${call.astrologerId},${profileRef},1,${fingerprint},${BIRTH_SHARING_NOTICE},${call.expiresAt}) ON CONFLICT ("consultationId") DO UPDATE SET "profileRef"=EXCLUDED."profileRef","revision"="ConsultationBirthSharing"."revision"+1,"birthVersion"=EXCLUDED."birthVersion","policyVersion"=EXCLUDED."policyVersion","expiresAt"=EXCLUDED."expiresAt","revokedAt"=NULL`;
          await tx.$executeRaw`INSERT INTO public."ConsultationBirthSharingAudit" ("id","consultationId","actorId","action","policyVersion","profileRef","birthVersion","revision") VALUES (${randomUUID()},${call.id},${actorId},'GRANT',${BIRTH_SHARING_NOTICE},${profileRef},${fingerprint},${(consent?.revision ?? 0) + 1})`;
        }
      }
      const shared = action === 'grant' || (valid && profileRef === consent.profileRef && fingerprint === consent.birthVersion);
      // Recheck time immediately before forming the response.
      const responseTime = new Date();
      if (call.expiresAt <= responseTime || (action !== 'grant' && valid && consent.expiresAt <= responseTime))
        throw new ForbiddenException('Sharing permission expired');
      return { state: !details ? 'MISSING_DETAILS' : shared ? 'SHARED' : 'NOT_SHARED',
        isCustomer: customer, details: customer || shared ? details : null,
        canRevoke: customer && (action === 'grant' || (!!consent && !consent.revokedAt)),
        astrologerName: accounts.find(u => u.id === call.astrologerId)?.name ?? 'Assigned astrologer',
        birthVersion: customer ? fingerprint : undefined, profiles: options, profileRef: customer ? profileRef : undefined,
        revision: customer ? (consent?.revision ?? 0) + (action === 'grant' && (!valid || consent.birthVersion !== fingerprint || consent.profileRef !== profileRef) ? 1 : 0) : undefined,
        policyVersion: BIRTH_SHARING_NOTICE, expiresAt: (action !== 'grant' && valid && consent.expiresAt < call.expiresAt ? consent.expiresAt : call.expiresAt).toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Birth sharing temporarily unavailable');
    }
  }
}
