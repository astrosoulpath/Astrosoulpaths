import { BadRequestException, ConflictException } from '@nestjs/common';
export type ModerationKind = 'CUSTOMER' | 'ASTROLOGER';
export type ModerationAction =
  | 'BLOCK'
  | 'UNBLOCK'
  | 'VERIFY'
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND'
  | 'REQUEST_CHANGES';
export type ModerationInput = {
  requestId: string;
  expectedVersion: number;
  reason: string;
  action: ModerationAction;
  requestedFields?: string[];
};
export function moderationInput(body: unknown): ModerationInput {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Moderation details are required');
  const b = body as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (k) => !['requestId', 'expectedVersion', 'reason', 'action', 'requestedFields'].includes(k),
    ) ||
    typeof b.requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      b.requestId,
    ) ||
    !Number.isSafeInteger(b.expectedVersion) ||
    (b.expectedVersion as number) < 0 ||
    typeof b.reason !== 'string' ||
    b.reason.trim().length < 10 ||
    b.reason.trim().length > 1000 ||
    /[\x00-\x1f]/.test(b.reason) ||
    !['BLOCK', 'UNBLOCK', 'VERIFY', 'APPROVE', 'REJECT', 'SUSPEND', 'REQUEST_CHANGES'].includes(
      b.action as string,
    )
  )
    throw new BadRequestException(
      'Valid reason, request ID, action and version are required',
    );
  const allowedFields=['bio','languages','identityProof','certificates','experienceProofs'];
  if(b.action==='REQUEST_CHANGES'){
    if(!Array.isArray(b.requestedFields)||b.requestedFields.length<1||b.requestedFields.length>5||new Set(b.requestedFields).size!==b.requestedFields.length||b.requestedFields.some(f=>typeof f!=='string'||!allowedFields.includes(f)))throw new BadRequestException('Choose the exact supported correction fields');
  }else if(b.requestedFields!==undefined)throw new BadRequestException('Correction fields require a correction request');
  return {
    requestId: b.requestId,
    expectedVersion: b.expectedVersion as number,
    reason: b.reason.trim(),
    action: b.action as ModerationAction,
    ...(b.action==='REQUEST_CHANGES'?{requestedFields:(b.requestedFields as string[]).slice().sort()}:{}),
  };
}
export function moderationTransition(
  kind: ModerationKind,
  state: string,
  action: ModerationAction,
): string {
  const transitions: Record<string, Record<string, string>> = kind ===
  'CUSTOMER'
    ? { ACTIVE: { BLOCK: 'BLOCKED' }, BLOCKED: { UNBLOCK: 'ACTIVE' } }
    : {
        UNREVIEWED: { VERIFY: 'REVIEWED', REJECT: 'REJECTED', REQUEST_CHANGES:'NEEDS_CHANGES' },
        REVIEWED: { APPROVE: 'APPROVED', REJECT: 'REJECTED', REQUEST_CHANGES:'NEEDS_CHANGES' },
        APPROVED: { SUSPEND: 'SUSPENDED' },
        SUSPENDED: { APPROVE: 'APPROVED', REQUEST_CHANGES:'NEEDS_CHANGES' },
        REJECTED: { VERIFY: 'REVIEWED', REQUEST_CHANGES:'NEEDS_CHANGES' },
        NEEDS_CHANGES: {REJECT:'REJECTED'},
      };
  const next = transitions[state]?.[action];
  if (!next)
    throw new ConflictException(
      'Invalid moderation transition. Refresh and review the account.',
    );
  return next;
}
