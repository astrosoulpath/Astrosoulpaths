import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:astro_soul_path/features/auth/data/auth_api.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/auth_portal.dart';
import 'package:astro_soul_path/features/auth/data/google_auth_service.dart';
import 'package:astro_soul_path/features/auth/presentation/screens/login_screen.dart';

class UserFixture extends Fake implements User {
  @override
  String get uid => 'fixture-owner';
}

class ApiFixture extends AuthApi {
  @override
  Future<VerifyOtpResult> firebaseGoogleLogin({
    required String idToken,
    required AuthPortal portal,
  }) async => const VerifyOtpResult(
    message: 'synthetic',
    portal: 'customer',
    role: 'CUSTOMER',
    accessToken: 'aspctx.fixture',
    user: {
      'id': 'canonical',
      'firebaseUid': 'fixture-owner',
      'authContext': 'customer',
      'accountRole': 'ADMIN',
    },
    session: {'authProvider': 'asp-context'},
    nextStep: 'OPEN_HOME',
  );
}

class SessionsFixture extends AuthSessionStore {
  SessionsFixture(this.failure);
  final Object failure;
  @override
  Future<void> clear() async {}
  @override
  Future<void> save(VerifyOtpResult result) async {}
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async => throw failure;
}

void main() {
  for (final known in [true, false]) {
    testWidgets(
      'Google onboarding ${known ? 'renewal' : 'unexpected'} failure is caught without raw data or unhandled exception',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: LoginScreen(
              portal: AuthPortal.customer,
              authApi: ApiFixture(),
              sessionStore: SessionsFixture(
                known
                    ? const AuthApiException(
                        'Secure session renewal failed. Please retry.',
                        code: 'CONTEXT_RENEWAL_HTTP_503',
                      )
                    : StateError('private-token credentials'),
              ),
              firebaseUidReader: () => 'fixture-owner',
              googleSignIn: () async => GoogleAuthResult(
                user: UserFixture(),
                firebaseIdToken: 'synthetic',
                googleEmail: 'fixture@example.invalid',
                googleName: null,
                googlePhotoUrl: null,
                googleIdToken: 'synthetic',
                googleAccessToken: 'synthetic',
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Continue with Google'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(
          find.text(
            known
                ? 'Secure session renewal failed. Please retry.'
                : 'Unable to complete secure sign-in. Please retry.',
          ),
          findsOneWidget,
        );
        expect(find.textContaining('private-token'), findsNothing);
        expect(find.byType(LoginScreen), findsOneWidget);
      },
    );
  }
}
