import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:astro_soul_path/features/customer/presentation/screens/edit_customer_profile_screen.dart';
import 'package:astro_soul_path/features/auth/data/firebase_phone_auth_service.dart';
import 'package:astro_soul_path/features/profile/data/profile_api.dart';

class Profile extends ProfileApi {
  final tokens = <String>[];
  @override
  Future<Map<String, dynamic>> refreshVerifiedPhone() async => {
    'phone': '+919876543210',
    'isPhoneVerified': true,
    'canonicalUserId': 'canonical',
  };
  @override
  Future<Map<String, dynamic>> verifyFirebaseProfilePhone({
    required String firebaseIdToken,
    bool confirmAccountLink = false,
  }) async {
    tokens.add(firebaseIdToken);
    return {'success': true};
  }
}

Future<void> open(WidgetTester tester, Widget widget) async {
  tester.view.physicalSize = const Size(1200, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(home: widget));
  final phone = find.widgetWithText(TextFormField, 'Mobile Number');
  await tester.ensureVisible(phone);
  await tester.enterText(phone, '+919876543210');
  await tester.tap(find.text('Verify').first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  testWidgets(
    '60-second cooldown preserves resend token and blocks verify during resend',
    (tester) async {
      final profile = Profile();
      final sends = <int?>[];
      final resend = Completer<FirebasePhoneCode>();
      await open(
        tester,
        EditCustomerProfileScreen(
          showPhoneVerificationForTesting: true,
          profile: null,
          now: tester.binding.clock.now,
          profileApi: profile,
          sendPhoneCode: (phone, token) async {
            sends.add(token);
            if (sends.length == 1) {
              return const FirebasePhoneCode(
                verificationId: 'first',
                resendToken: 7,
              );
            }
            return resend.future;
          },
          verifyPhoneCode: (id, code) async {
            expect(id, 'second');
            return 'otp-proof';
          },
        ),
      );
      expect(sends, [null]);
      expect(find.textContaining('Resend OTP in'), findsOneWidget);
      await tester.pump(const Duration(seconds: 61));
      await tester.pump();
      await tester.tap(find.text('Resend OTP'));
      await tester.pump();
      expect(sends, [null, 7]);
      final verify = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Verify'),
      );
      expect(verify.onPressed, isNull);
      resend.complete(
        const FirebasePhoneCode(verificationId: 'second', resendToken: 8),
      );
      await tester.pump();
      await tester.pump();
      await tester.enterText(find.byType(TextField).last, '123456');
      await tester.tap(find.widgetWithText(FilledButton, 'Verify'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(profile.tokens, ['otp-proof']);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );
  testWidgets(
    'too-many-requests on send starts cooldown without opening OTP dialog',
    (tester) async {
      var sends = 0;
      await open(
        tester,
        EditCustomerProfileScreen(
          showPhoneVerificationForTesting: true,
          profile: null,
          now: tester.binding.clock.now,
          sendPhoneCode: (phone, token) async {
            sends++;
            throw FirebaseException(
              plugin: 'firebase_auth',
              code: 'too-many-requests',
            );
          },
        ),
      );
      expect(sends, 1);
      expect(
        find.textContaining('Firebase has limited verification attempts'),
        findsOneWidget,
      );
      expect(find.text('Verify Mobile Number'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );
  testWidgets('duplicate verification is guarded and blocks resend', (
    tester,
  ) async {
    var verifies = 0;
    final proof = Completer<String>();
    await open(
      tester,
      EditCustomerProfileScreen(
        showPhoneVerificationForTesting: true,
        profile: null,
        now: tester.binding.clock.now,
        profileApi: Profile(),
        sendPhoneCode: (p, t) async =>
            const FirebasePhoneCode(verificationId: 'id'),
        verifyPhoneCode: (id, code) {
          verifies++;
          return proof.future;
        },
      ),
    );
    await tester.enterText(find.byType(TextField).last, '123456');
    final callback = tester
        .widget<FilledButton>(find.widgetWithText(FilledButton, 'Verify'))
        .onPressed!;
    callback();
    callback();
    await tester.pump();
    expect(verifies, 1);
    proof.complete('proof');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });
  testWidgets(
    'resend throttling is handled and retains the last verification ID',
    (tester) async {
      var sends = 0;
      final profile = Profile();
      await open(
        tester,
        EditCustomerProfileScreen(
          showPhoneVerificationForTesting: true,
          profile: null,
          now: tester.binding.clock.now,
          profileApi: profile,
          sendPhoneCode: (phone, token) async {
            sends++;
            if (sends == 1) {
              return const FirebasePhoneCode(
                verificationId: 'original',
                resendToken: 9,
              );
            }
            expect(token, 9);
            throw FirebaseException(
              plugin: 'firebase_auth',
              code: 'too-many-requests',
            );
          },
          verifyPhoneCode: (id, code) async {
            expect(id, 'original');
            return 'proof';
          },
        ),
      );
      await tester.pump(const Duration(seconds: 61));
      await tester.pump();
      await tester.tap(find.text('Resend OTP'));
      await tester.pump();
      await tester.pump();
      expect(
        find.textContaining('Firebase has limited verification attempts'),
        findsOneWidget,
      );
      expect(find.textContaining('Resend OTP in'), findsOneWidget);
      expect(sends, 2);
      await tester.enterText(find.byType(TextField).last, '123456');
      await tester.tap(find.widgetWithText(FilledButton, 'Verify'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(profile.tokens, ['proof']);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );
  testWidgets(
    'OTP verification succeeds during resend cooldown and refreshes phone state',
    (tester) async {
      final profile = Profile();
      await open(
        tester,
        EditCustomerProfileScreen(
          showPhoneVerificationForTesting: true,
          profile: null,
          profileApi: profile,
          now: tester.binding.clock.now,
          sendPhoneCode: (_, _) async =>
              const FirebasePhoneCode(verificationId: 'first'),
          verifyPhoneCode: (_, _) async => 'verified-proof',
        ),
      );
      expect(find.textContaining('Resend OTP in'), findsOneWidget);
      await tester.enterText(find.byType(TextField).last, '123456');
      await tester.tap(find.widgetWithText(FilledButton, 'Verify'));
      await tester.pumpAndSettle();
      expect(profile.tokens, ['verified-proof']);
      expect(find.text('Mobile number verified successfully'), findsOneWidget);
    },
  );
}
