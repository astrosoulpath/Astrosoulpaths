import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/customer_onboarding_flow.dart';
import 'package:astro_soul_path/features/profile/data/customer_profile.dart';

class Sessions extends AuthSessionStore {
  bool complete = false;
  String id = 'canonical';
  int restores = 0;
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async {
    restores++;
    return StoredAuthSession(
      accessToken: 'mock-proof',
      refreshToken: '',
      role: 'CUSTOMER',
      portal: 'customer',
      nextStep: 'OPEN_HOME',
      user: {'id': id, 'isProfileComplete': complete},
      expiresIn: 3600,
    );
  }
}

void main() {
  test('incomplete existing profile is reused by the form', () async {
    final sessions = Sessions();
    final profile = CustomerProfile.fromJson({
      'id': 'existing',
      'userId': 'canonical',
    });
    expect(
      await completeCustomerOnboarding(
        sessions: sessions,
        loadProfiles: () async => [profile],
        showForm: (existing) async {
          expect(existing, same(profile));
          sessions.complete = true;
          return true;
        },
      ),
      true,
    );
  });
  test(
    'completed existing/restored session skips form and profile request',
    () async {
      final sessions = Sessions()..complete = true;
      expect(
        await completeCustomerOnboarding(
          sessions: sessions,
          loadProfiles: () async => throw StateError('must not load'),
          showForm: (_) async => throw StateError('must not prompt'),
        ),
        true,
      );
    },
  );
  for (final provider in ['Google', 'Phone']) {
    test(
      '$provider new customer waits for saved completion before dashboard',
      () async {
        final sessions = Sessions();
        var forms = 0;
        expect(
          await completeCustomerOnboarding(
            sessions: sessions,
            loadProfiles: () async => [],
            showForm: (existing) async {
              forms++;
              expect(existing, isNull);
              sessions.complete = true;
              return true;
            },
          ),
          true,
        );
        expect(forms, 1);
        expect(sessions.restores, 2);
        expect(sessions.id, 'canonical');
      },
    );
  }
  test(
    'cancelled form keeps account incomplete and never refreshes completion',
    () async {
      final sessions = Sessions();
      expect(
        await completeCustomerOnboarding(
          sessions: sessions,
          loadProfiles: () async => [],
          showForm: (_) async => null,
        ),
        false,
      );
      expect(sessions.complete, false);
      expect(sessions.restores, 1);
    },
  );
  test('failed submission cannot grant dashboard access', () async {
    final sessions = Sessions();
    await expectLater(
      completeCustomerOnboarding(
        sessions: sessions,
        loadProfiles: () async => [],
        showForm: (_) async => throw StateError('save failed'),
      ),
      throwsStateError,
    );
    expect(sessions.complete, false);
    expect(sessions.id, 'canonical');
  });
  test('form result alone cannot mark completion', () async {
    final sessions = Sessions();
    expect(
      await completeCustomerOnboarding(
        sessions: sessions,
        loadProfiles: () async => [],
        showForm: (_) async => true,
      ),
      false,
    );
  });
  test('changed canonical session after submit cannot grant access', () async {
    final sessions = Sessions();
    expect(
      await completeCustomerOnboarding(
        sessions: sessions,
        loadProfiles: () async => [],
        showForm: (_) async {
          sessions.complete = true;
          sessions.id = 'different';
          return true;
        },
      ),
      false,
    );
  });
}
