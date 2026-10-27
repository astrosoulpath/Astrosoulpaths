import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/google_auth_service.dart';
import 'package:astro_soul_path/features/auth/data/customer_session_policy.dart';

void main() {
  test(
    'explicit Google selection clears previous selection before authenticate',
    () async {
      final events = <String>[];
      final selected = await selectGoogleAccount(
        signOutSelection: () async {
          events.add('selection-cleared');
        },
        authenticate: () async {
          events.add('chooser');
          return 'chosen';
        },
      );
      expect(events, ['selection-cleared', 'chooser']);
      expect(selected, 'chosen');
    },
  );
  test(
    'selection cleanup failure does not authenticate or silently reuse account',
    () async {
      var calls = 0;
      await expectLater(
        selectGoogleAccount(
          signOutSelection: () async => throw StateError('synthetic'),
          authenticate: () async {
            calls++;
            return 'unexpected';
          },
        ),
        throwsStateError,
      );
      expect(calls, 0);
    },
  );
  test('cancelled chooser has no retry or fallback identity', () async {
    var calls = 0;
    await expectLater(
      selectGoogleAccount(
        signOutSelection: () async {},
        authenticate: () async {
          calls++;
          throw const GoogleAuthCancelledException();
        },
      ),
      throwsA(isA<GoogleAuthCancelledException>()),
    );
    expect(calls, 1);
  });
  test(
    'canonical role overrides Customer presentation without changing other portals',
    () {
      expect(
        isAdminInCustomerPortal('customer', {
          'role': 'CUSTOMER',
          'accountRole': ' admin ',
        }),
        true,
      );
      expect(
        isAdminInCustomerPortal('customer', {'accountRole': 'USER'}),
        false,
      );
      expect(
        isAdminInCustomerPortal('customer', {'accountRole': 'CUSTOMER'}),
        false,
      );
      expect(
        isAdminInCustomerPortal('customer', {'accountRole': 'ASTROLOGER'}),
        false,
      );
      expect(isAdminInCustomerPortal('admin', {'accountRole': 'ADMIN'}), false);
    },
  );
}
