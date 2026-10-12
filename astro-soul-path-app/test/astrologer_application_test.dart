import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/astrologer/data/astrologer_portal_api.dart';
import 'package:astro_soul_path/features/astrologer/presentation/screens/astrologer_registration_screen.dart';
import 'package:astro_soul_path/features/auth/data/firebase_phone_auth_service.dart';
import 'package:astro_soul_path/features/profile/data/profile_api.dart';
import 'package:astro_soul_path/features/astrologer/presentation/screens/astrologer_application_screen.dart';

class ApplicationSessions extends AuthSessionStore {
  bool missing = false;
  String id = 'original';
  String step = 'COMPLETE_ASTROLOGER_ONBOARDING';
  final calls = <String>[];
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async {
    calls.add('${portal ?? ''}:$persist');
    if (missing) return null;
    return StoredAuthSession(
      accessToken: 'test-token',
      refreshToken: '',
      role: 'CUSTOMER',
      portal: 'customer',
      nextStep: step,
      user: {
        'id': id,
        'phone': '+919876543210',
        'isPhoneVerified': step != 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING',
      },
      expiresIn: 3600,
    );
  }
}

class ApplicationProfile extends ProfileApi {
  ApplicationProfile(this.sessions);
  final ApplicationSessions sessions;
  final tokens = <String>[];
  @override
  Future<void> attachVerifiedFirebasePhone(String token) async {
    tokens.add(token);
    sessions.step = 'COMPLETE_ASTROLOGER_ONBOARDING';
  }
}

void main() {
  testWidgets('signed-in customer continues without login or repeat OTP', (
    tester,
  ) async {
    final sessions = ApplicationSessions();
    await tester.pumpWidget(
      MaterialApp(home: AstrologerApplicationScreen(sessionStore: sessions)),
    );
    await tester.pumpAndSettle();
    expect(sessions.calls, ['joinAstrologer:false']);
    expect(find.text('Continue application'), findsOneWidget);
    expect(find.text('Send OTP'), findsNothing);
    expect(find.text('Open Customer Dashboard'), findsOneWidget);
  });
  testWidgets('pending applicant cannot open astrologer dashboard', (
    tester,
  ) async {
    final sessions = ApplicationSessions()..step = 'WAIT_FOR_ADMIN_APPROVAL';
    await tester.pumpWidget(
      MaterialApp(home: AstrologerApplicationScreen(sessionStore: sessions)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Open Astrologer Dashboard'), findsNothing);
    expect(find.text('Continue application'), findsNothing);
    expect(find.text('Open Customer Dashboard'), findsOneWidget);
  });
  testWidgets(
    'unverified authenticated applicant opens questions; FAIL blocks registration',
    (tester) async {
      final sessions = ApplicationSessions()
        ..step = 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING';
      var questions = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: AstrologerApplicationScreen(
            sessionStore: sessions,
            openQualification: (_, token) async {
              expect(token, 'test-token');
              questions++;
              return false;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Send OTP'), findsNothing);
      await tester.tap(find.text('Continue application'));
      await tester.pumpAndSettle();
      expect(questions, 1);
      expect(find.byType(AstrologerRegistrationScreen), findsNothing);
    },
  );
  testWidgets(
    'unauthenticated applicant requires Google or Email authentication',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: AstrologerApplicationScreen(
            sessionStore: ApplicationSessions()..missing = true,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Sign in with Google or Email before qualification.'),
        findsOneWidget,
      );
      expect(find.text('Continue application'), findsNothing);
    },
  );
  for (final persisted in [true, false]) {
    testWidgets('registration checks persisted PASS $persisted', (
      tester,
    ) async {
      final sessions = ApplicationSessions()
        ..step = 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING';
      await tester.pumpWidget(
        MaterialApp(
          home: AstrologerApplicationScreen(
            sessionStore: sessions,
            portalApi: QualificationStatus(persisted),
            openQualification: (_, _) async => true,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continue application'));
      await tester.pumpAndSettle();
      expect(
        find.byType(AstrologerRegistrationScreen),
        persisted ? findsOneWidget : findsNothing,
      );
      if (persisted) {
        final form = tester.widget<AstrologerRegistrationScreen>(
          find.byType(AstrologerRegistrationScreen),
        );
        expect(form.canonicalUserId, 'original');
        expect(form.sessionStore, same(sessions));
        expect(find.text('Send OTP'), findsNothing);
        await tester.ensureVisible(find.text('Submit for Admin Approval'));
        await tester.tap(find.text('Submit for Admin Approval'));
        await tester.pumpAndSettle();
        expect(find.byType(AstrologerRegistrationScreen), findsOneWidget);
      }
    });
  }
  for (final verified in [true, false]) {
    testWidgets('deferred verification reuses canonical account $verified', (
      tester,
    ) async {
      final sessions = ApplicationSessions();
      if (!verified) {
        sessions.step = 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING';
      }
      final profile = ApplicationProfile(sessions);
      StoredAuthSession? returned;
      var sends = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                child: const Text('Open verification'),
                onPressed: () async {
                  returned = await Navigator.of(context)
                      .push<StoredAuthSession>(
                        MaterialPageRoute(
                          builder: (_) => AstrologerApplicationScreen(
                            phoneVerificationOnly: true,
                            canonicalUserId: 'original',
                            sessionStore: sessions,
                            profileApi: profile,
                            sendPhoneCode: (_) async {
                              sends++;
                              return const FirebasePhoneCode(
                                verificationId: 'proof-id',
                              );
                            },
                            verifyPhoneCode: (_, code) async {
                              expect(code, '123456');
                              return 'verified-proof';
                            },
                          ),
                        ),
                      );
                },
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open verification'));
      await tester.pumpAndSettle();
      if (!verified) {
        await tester.tap(find.text('Send OTP'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).last, '123456');
        await tester.tap(find.text('Verify and continue'));
        await tester.pumpAndSettle();
        expect(profile.tokens, ['verified-proof']);
      }
      expect(sends, verified ? 0 : 1);
      expect(returned?.user['id'], 'original');
      expect(returned?.user['isPhoneVerified'], true);
    });
  }
  testWidgets('canonical account change blocks registration continuation', (
    tester,
  ) async {
    final sessions = ApplicationSessions();
    await tester.pumpWidget(
      MaterialApp(
        home: AstrologerApplicationScreen(
          sessionStore: sessions,
          portalApi: QualificationStatus(true),
          openQualification: (_, _) async {
            sessions.id = 'other';
            return true;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue application'));
    await tester.pumpAndSettle();
    expect(find.byType(AstrologerRegistrationScreen), findsNothing);
  });
}

class QualificationStatus extends AstrologerPortalApi {
  QualificationStatus(this.passed);
  final bool passed;
  @override
  Future<Map<String, dynamic>> getQualificationStatus({
    required String accessToken,
  }) async => {
    'success': true,
    'data': {'passed': passed},
  };
}
