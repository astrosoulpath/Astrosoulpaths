/// Validate against a freshly authenticated backend response, never FCM text.
bool authorizedSubscriptionReminder(
  Map<String, dynamic> payload,
  Map<String, dynamic> summary, {
  required String ownerId,
  required String portal,
}) {
  final role = payload['roleContext'];
  final preference = summary['preference'];
  if (payload['type'] != 'subscription_expiry' ||
      ownerId.isEmpty ||
      payload['ownerId'] != ownerId ||
      summary['ownerId'] != ownerId ||
      !const ['CUSTOMER', 'ASTROLOGER'].contains(role) ||
      role.toString().toLowerCase() != portal.toLowerCase() ||
      summary['roleContext'] != role ||
      summary['pushGateEnabled'] != true ||
      preference is! Map ||
      preference['pushEnabled'] != true) {
    return false;
  }
  final subscription = summary['subscription'];
  if (subscription is! Map ||
      subscription['id'] != payload['subscriptionId'] ||
      subscription['periodVerified'] != true ||
      !const ['ACTIVE', 'EXPIRED'].contains(subscription['status'])) {
    return false;
  }
  final now = DateTime.tryParse(summary['serverNow']?.toString() ?? '');
  final expiry = DateTime.tryParse(subscription['expiresAt']?.toString() ?? '');
  if (now == null || expiry == null) return false;
  final remaining = expiry.difference(now).inMilliseconds;
  if (remaining <= -86400000 || remaining > 7 * 86400000) return false;
  final milestone = (remaining / 86400000).ceil().clamp(0, 7);
  final reminderId = payload['reminderId'];
  if (reminderId is! String) return false;
  final id = reminderId.split(':').first;
  return (summary['reminders'] as List? ?? []).whereType<Map>().any(
    (r) =>
        r['id'] == id &&
        r['milestone'] == milestone &&
        r['subscriptionId'] == payload['subscriptionId'],
  );
}
