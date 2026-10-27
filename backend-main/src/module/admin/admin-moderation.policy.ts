import { BadRequestException, ConflictException } from '@nestjs/common';
export type ModerationKind = 'CUSTOMER' | 'ASTROLOGER';
export type ModerationAction =
  | 'BLOCK'
  | 'UNBLOCK'
  | 'VERIFY'
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND';
export type ModerationInput = {
  requestId: string;
  expectedVersion: number;
  reason: string;
  action: ModerationAction;
};
export function moderationInput(body: unknown): ModerationInput {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Moderation details are required');
  const b = body as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (k) => !['requestId', 'expectedVersion', 'reason', 'action'].includes(k),
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
    !['BLOCK', 'UNBLOCK', 'VERIFY', 'APPROVE', 'REJECT', 'SUSPEND'].includes(
      b.action as string,
    )
  )
    throw new BadRequestException(
      'Valid reason, request ID, action and version are required',
    );
  return {
    requestId: b.requestId,
    expectedVersion: b.expectedVersion as number,
    reason: b.reason.trim(),
    action: b.action as ModerationAction,
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
        UNREVIEWED: { VERIFY: 'REVIEWED', REJECT: 'REJECTED' },
        REVIEWED: { APPROVE: 'APPROVED', REJECT: 'REJECTED' },
        APPROVED: { SUSPEND: 'SUSPENDED' },
        SUSPENDED: { APPROVE: 'APPROVED' },
        REJECTED: { VERIFY: 'REVIEWED' },
      };
  const next = transitions[state]?.[action];
  if (!next)
    throw new ConflictException(
      'Invalid moderation transition. Refresh and review the account.',
    );
  return next;
}
