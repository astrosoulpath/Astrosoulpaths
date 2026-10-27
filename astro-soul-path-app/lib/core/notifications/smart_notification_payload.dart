/// Structural validation only. Backend authorization remains authoritative.
bool validSmartNotificationPayload(
  Map<String, dynamic> payload, {
  DateTime? now,
}) {
  if (payload['type'] != 'smart_insight') return true;
  final id = payload['insightId'];
  final owner = payload['ownerId'];
  final locale = payload['locale'];
  const locales = {
    'en',
    'hi',
    'bn',
    'ta',
    'te',
    'mr',
    'gu',
    'kn',
    'ml',
    'pa',
    'es',
    'fr',
    'de',
    'pt',
    'it',
    'ja',
    'ko',
    'zh',
    'ar',
    'ru',
  };
  if (id is! String ||
      !RegExp(
        r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
      ).hasMatch(id) ||
      owner is! String ||
      owner.trim().isEmpty ||
      !locales.contains(locale)) {
    return false;
  }
  final expiry = payload['expiresAt'];
  if (expiry != null) {
    if (expiry is! String) return false;
    final date = DateTime.tryParse(expiry);
    if (date == null || !date.isAfter(now ?? DateTime.now())) return false;
  }
  return true;
}
