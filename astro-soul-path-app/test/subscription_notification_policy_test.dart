import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/notifications/subscription_notification_policy.dart';

void main() {
  for (final role in ['CUSTOMER', 'ASTROLOGER']) {
    for (var milestone = 0; milestone <= 7; milestone++) {
      test(
        '$role validates milestone $milestone against fresh owner and server clock',
        () {
          final expiry = DateTime.utc(2026, 11, 6, 12),
              now = expiry.subtract(Duration(days: milestone));
          final payload = <String, dynamic>{
            'type': 'subscription_expiry',
            'ownerId': 'owner',
            'roleContext': role,
            'reminderId': 'event:phone',
            'subscriptionId': 'subscription',
          };
          final summary = <String, dynamic>{
            'ownerId': 'owner',
            'roleContext': role,
            'serverNow': now.toIso8601String(),
            'pushGateEnabled': true,
            'preference': {'pushEnabled': true},
            'subscription': {
              'id': 'subscription',
              'expiresAt': expiry.toIso8601String(),
              'status': milestone == 0 ? 'EXPIRED' : 'ACTIVE',
              'periodVerified': true,
            },
            'reminders': [
              {
                'id': 'event',
                'milestone': milestone,
                'subscriptionId': 'subscription',
              },
            ],
          };
          bool accepts(Map<String, dynamic> p, Map<String, dynamic> s) =>
              authorizedSubscriptionReminder(
                p,
                s,
                ownerId: 'owner',
                portal: role.toLowerCase(),
              );
          expect(accepts(payload, summary), true);
          expect(accepts({...payload, 'ownerId': 'other'}, summary), false);
          expect(
            accepts({
              ...payload,
              'roleContext': role == 'CUSTOMER' ? 'ASTROLOGER' : 'CUSTOMER',
            }, summary),
            false,
          );
          expect(accepts({...payload, 'ownerId': null}, summary), false);
          expect(
            accepts(payload, {...summary, 'pushGateEnabled': false}),
            false,
          );
          expect(
            accepts(payload, {
              ...summary,
              'preference': {'pushEnabled': false},
            }),
            false,
          );
          expect(
            accepts(payload, {
              ...summary,
              'subscription': {'id': 'renewed'},
            }),
            false,
          );
          expect(accepts(payload, {...summary, 'reminders': []}), false);
          expect(
            accepts(payload, {
              ...summary,
              'serverNow': expiry
                  .add(const Duration(days: 1))
                  .toIso8601String(),
            }),
            false,
          );
        },
      );
    }
  }
}
