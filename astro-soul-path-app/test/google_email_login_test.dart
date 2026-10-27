import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:astro_soul_path/features/auth/data/auth_api.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/astrologer/presentation/screens/astrologer_application_screen.dart';
import 'package:astro_soul_path/features/auth/data/auth_portal.dart';
import 'package:astro_soul_path/features/auth/presentation/screens/login_screen.dart';

class EmailUser extends Fake implements User {
  @override
  String get uid => 'fixture-email-owner';
  int verifications = 0;
  bool verified = false;
  @override
  bool get emailVerified => verified;
  @override
  Future<String?> getIdToken([bool forceRefresh = false]) async =>
      'verified-proof';
  @override
  List<UserInfo> get providerData => [GoogleInfo()];
  @override
  Future<void> sendEmailVerification([ActionCodeSettings? settings]) async {
    verifications++;
  }
}

class EmailCredential extends Fake implements UserCredential {
  EmailCredential(this.value);
  final User value;
  @override
  User? get user => value;
}

class EmailAuth extends Fake implements FirebaseAuth {
  final user = EmailUser();
  @override
  User? get currentUser => user;
  int creates = 0, signins = 0, resets = 0, signouts = 0;
  @override
  Future<UserCredential> createUserWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    creates++;
    return EmailCredential(user);
  }

  @override
  Future<UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    signins++;
    return EmailCredential(user);
  }

  @override
  Future<void> sendPasswordResetEmail({
    required String email,
    ActionCodeSettings? actionCodeSettings,
  }) async {
    resets++;
  }

  @override
  Future<void> signOut() async {
    signouts++;
  }
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final portal in AuthPortal.values) {
    testWidgets(
      'Google/Email only entry and deferred email form: ${portal.name}',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: LoginScreen(portal: portal, emailAuth: EmailAuth()),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Continue with Google'), findsOneWidget);
        expect(find.text('Continue with Email'), findsOneWidget);
        expect(find.text('Mobile Number'), findsNothing);
        expect(find.byType(TextFormField), findsNothing);
        await tester.ensureVisible(find.text('Continue with Email'));
        await tester.tap(find.text('Continue with Email'));
        await tester.pumpAndSettle();
        expect(
          find.widgetWithText(TextFormField, 'Email address'),
          findsOneWidget,
        );
        expect(find.text('Forgot Password?'), findsOneWidget);
      },
    );
  }
  testWidgets(
    'signup sends verification and clears unverified native session',
    (tester) async {
      final auth = EmailAuth();
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            portal: AuthPortal.joinAstrologer,
            emailAuth: auth,
            sessionStore: PortalSessions(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Continue with Email'));
      await tester.tap(find.text('Continue with Email'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create Account'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Email address'),
        'new@example.invalid',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Password'),
        'valid-password',
      );
      await tester.tap(find.text('Create Account'));
      await tester.pumpAndSettle();
      expect(auth.creates, 1);
      expect(auth.user.verifications, 1);
      expect(auth.signouts, 1);
    },
  );
  testWidgets('password reset validates email without requiring password', (
    tester,
  ) async {
    final auth = EmailAuth();
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          portal: AuthPortal.customer,
          emailAuth: auth,
          sessionStore: PortalSessions(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Continue with Email'));
    await tester.tap(find.text('Continue with Email'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Forgot Password?'));
    await tester.pumpAndSettle();
    expect(auth.resets, 0);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email address'),
      'owner@example.invalid',
    );
    await tester.tap(find.text('Forgot Password?'));
    await tester.pumpAndSettle();
    expect(auth.resets, 1);
    expect(auth.signins, 0);
  });
  testWidgets(
    'resend requires password proof and cannot enter an unverified account',
    (tester) async {
      final auth = EmailAuth();
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            portal: AuthPortal.astrologer,
            emailAuth: auth,
            sessionStore: PortalSessions(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Continue with Email'));
      await tester.tap(find.text('Continue with Email'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Email address'),
        'owner@example.invalid',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Password'),
        'valid-password',
      );
      await tester.tap(find.text('Resend Verification Email'));
      await tester.pumpAndSettle();
      expect(auth.signins, 1);
      expect(auth.user.verifications, 1);
      expect(auth.signouts, 1);
    },
  );
  for (final portal in [AuthPortal.astrologer, AuthPortal.joinAstrologer]) {
    testWidgets(
      'verified email uses backend portal status without granting approval: $portal',
      (tester) async {
        final auth = EmailAuth();
        auth.user.verified = true;
        final sessions = PortalSessions();
        await tester.pumpWidget(
          MaterialApp(
            home: LoginScreen(
              portal: portal,
              emailAuth: auth,
              authApi: EmailApi(),
              sessionStore: sessions,
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Continue with Email'));
        await tester.tap(find.text('Continue with Email'));
        await tester.pumpAndSettle();
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Email address'),
          'owner@example.invalid',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Password'),
          'valid-password',
        );
        await tester.tap(find.text('Sign In'));
        await tester.pumpAndSettle();
        expect(sessions.portals.first, portal.name);
        expect(find.byType(AstrologerApplicationScreen), findsOneWidget);
        expect(find.text('Open Astrologer Dashboard'), findsNothing);
        expect(find.textContaining('under review'), findsOneWidget);
      },
    );
  }
}

class GoogleInfo extends Fake implements UserInfo {
  @override
  String get providerId => 'google.com';
}

class EmailApi extends AuthApi {
  @override
  Future<VerifyOtpResult> firebaseEmailLogin({
    required String idToken,
    AuthPortal portal = AuthPortal.customer,
  }) async {
    expect(idToken, 'verified-proof');
    return const VerifyOtpResult(
      message: 'verified',
      portal: 'customer',
      role: 'CUSTOMER',
      accessToken: 'token',
      user: {'id': 'canonical', 'firebaseUid': 'fixture-email-owner'},
      session: {'authProvider': 'firebase'},
      nextStep: 'OPEN_HOME',
    );
  }
}

class PortalSessions extends AuthSessionStore {
  final portals = <String>[];
  // Widget tests inject storage rather than sharing secure-storage Futures
  // across independent FakeAsync zones. Real storage fencing has its own suite.
  @override
  Future<void> clear() async {}
  @override
  Future<void> save(VerifyOtpResult result) async {
    expect(result.user['id'], 'canonical');
  }

  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async {
    portals.add(portal ?? '');
    return StoredAuthSession(
      accessToken: 'token',
      refreshToken: '',
      role: 'ASTROLOGER_APPLICANT',
      portal: portal ?? 'joinAstrologer',
      nextStep: 'WAIT_FOR_ADMIN_APPROVAL',
      user: {'id': 'canonical', 'isPhoneVerified': false},
      expiresIn: 3600,
    );
  }
}
