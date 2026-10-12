import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/firebase_phone_auth_service.dart';
import 'package:astro_soul_path/features/profile/data/profile_api.dart';
import 'package:astro_soul_path/features/astrologer/presentation/screens/astrologer_application_screen.dart';

class ApplicationSessions extends AuthSessionStore {
  String step = 'COMPLETE_ASTROLOGER_ONBOARDING';
  final calls = <String>[];
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async {
    calls.add('${portal ?? ''}:$persist');
    return StoredAuthSession(
      accessToken: 'test-token',
      refreshToken: '',
      role: 'CUSTOMER',
      portal: 'customer',
      nextStep: step,
      user: {
        'id': 'original',
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
    'OTP proof is attached to the current account before continuing',
    (tester) async {
      final sessions = ApplicationSessions()
        ..step = 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING';
      final profile = ApplicationProfile(sessions);
      await tester.pumpWidget(
        MaterialApp(
          home: AstrologerApplicationScreen(
            sessionStore: sessions,
            profileApi: profile,
            sendPhoneCode: (phone) async {
              expect(phone, '+919876543210');
              return const FirebasePhoneCode(verificationId: 'verification');
            },
            verifyPhoneCode: (id, code) async {
              expect(id, 'verification');
              expect(code, '123456');
              return 'verified-otp-proof';
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Send OTP'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, '123456');
      await tester.tap(find.text('Verify and continue'));
      await tester.pumpAndSettle();
      expect(profile.tokens, ['verified-otp-proof']);
      expect(find.text('Continue application'), findsOneWidget);
      expect(sessions.calls, ['joinAstrologer:false', 'joinAstrologer:false']);
    },
  );
}
