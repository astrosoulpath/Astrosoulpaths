import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/notifications/smart_notification_payload.dart';

void main() {
  final valid = <String, dynamic>{
    'type': 'smart_insight',
    'insightId': '12345678-1234-4234-8234-123456789abc',
    'ownerId': 'synthetic',
    'locale': 'fr',
  };
  test(
    'legacy routing is preserved',
    () => expect(validSmartNotificationPayload({'type': 'legacy'}), isTrue),
  );
  test(
    'valid exact insight retains legacy expiry-optional compatibility',
    () => expect(validSmartNotificationPayload(valid), isTrue),
  );
  for (final field in ['ownerId', 'insightId', 'locale']) {
    test('smart route rejects missing $field', () {
      final payload = {...valid}..remove(field);
      expect(validSmartNotificationPayload(payload), isFalse);
    });
  }
  test(
    'invalid id or unsupported locale cannot fall back to another reading',
    () {
      expect(
        validSmartNotificationPayload({...valid, 'insightId': 'today'}),
        isFalse,
      );
      expect(
        validSmartNotificationPayload({...valid, 'locale': 'xx'}),
        isFalse,
      );
    },
  );
  test('expired and malformed TTL rejected while future TTL accepted', () {
    final now = DateTime.utc(2026, 10, 17);
    for (final expiry in ['invalid', '2026-10-16T00:00:00Z']) {
      expect(
        validSmartNotificationPayload({
          ...valid,
          'expiresAt': expiry,
        }, now: now),
        isFalse,
      );
    }
    expect(
      validSmartNotificationPayload({
        ...valid,
        'expiresAt': '2026-10-18T00:00:00Z',
      }, now: now),
      isTrue,
    );
  });
}
