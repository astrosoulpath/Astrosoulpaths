/** Offline assessment only: never connects, sends, enables or certifies evidence. */
export const NOTIFICATION_RELEASE_EVIDENCE = [
  'restrictedOriginalDatabase',
  'freshBackupRestore',
  'encryptionAndKeys',
  'retentionRpoRto',
  'privacyConsentPolicy',
  'qualifiedLocaleReview',
  'firebaseProjectAndAuth',
  'androidDeviceE2e',
  'iosDeviceE2e',
  'migrationPostflight',
  'monitoringAndRollback',
  'ownerActivationApproval',
] as const;

export function assessNotificationActivation(
  env: Record<string, string | undefined>,
  evidence: Partial<
    Record<(typeof NOTIFICATION_RELEASE_EVIDENCE)[number], boolean>
  > = {},
) {
  const flags = [
    'SMART_NOTIFICATIONS_SCHEMA_READY',
    'SMART_NOTIFICATIONS_DELIVERY_ENABLED',
    'SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED',
    'SMART_NOTIFICATIONS_CONSENT_POLICY_APPROVED',
    'SMART_ASTROLOGY_AUTOMATIC_ENABLED',
    'SMART_ASTROLOGY_PREVIEW_ENABLED',
    'SMART_NOTIFICATION_ENGAGEMENT_APPROVED',
    'NOTIFICATION_SELF_TEST_ENABLED',
    'NOTIFICATION_EDITORIAL_CAMPAIGNS_ENABLED',
    'SMART_ENGAGEMENT_ENABLED',
    'HOROSCOPE_DURABLE_ENABLED',
    'HOROSCOPE_SCHEMA_READY',
    'HOROSCOPE_OUTBOX_ENABLED',
  ];
  const blockers: string[] = [];
  if (
    env.SMART_NOTIFICATIONS_EMERGENCY_DISABLED !== undefined &&
    !['true', 'false'].includes(env.SMART_NOTIFICATIONS_EMERGENCY_DISABLED)
  )
    blockers.push('INVALID_FLAG:SMART_NOTIFICATIONS_EMERGENCY_DISABLED');
  for (const flag of flags) {
    if (env[flag] !== undefined && !['true', 'false'].includes(env[flag]!))
      blockers.push('INVALID_FLAG:' + flag);
    if (env[flag] === 'true') blockers.push('PREFLIGHT_REQUIRES_OFF:' + flag);
  }
  for (const gate of NOTIFICATION_RELEASE_EVIDENCE)
    if (evidence[gate] !== true) blockers.push('EVIDENCE_REQUIRED:' + gate);
  return {
    status: blockers.length ? 'BLOCKED' : 'PREPARED_NOT_ACTIVATED',
    blockers,
    activated: false,
    evidenceIndependentlyVerified: false,
  };
}
