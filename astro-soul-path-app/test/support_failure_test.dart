import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/support/data/support_api.dart';
import 'package:astro_soul_path/features/support/presentation/widgets/support_failure.dart';
import 'package:astro_soul_path/features/auth/presentation/screens/login_screen.dart';
import 'package:astro_soul_path/features/auth/data/auth_portal.dart';

void main() {
  testWidgets(
    'logout fencing can remove the button before customer login navigation',
    (tester) async {
      final visible = ValueNotifier(true);
      addTearDown(visible.dispose);
      final done = Completer<void>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ValueListenableBuilder<bool>(
              valueListenable: visible,
              builder: (_, show, _) => show
                  ? CustomerSupportRecoveryButton(signOut: () => done.future)
                  : const Text('Session cleared'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Use a customer account'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out and continue'));
      await tester.pump();
      visible.value = false;
      await tester.pump();
      done.complete();
      // Existing login artwork animates continuously; wait only for navigation.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(
        tester.widget<LoginScreen>(find.byType(LoginScreen)).portal,
        AuthPortal.customer,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  test('Admin 403 remains denied and offers explicit customer recovery', () {
    final f = SupportFailure.from(
      const SupportApiException(
        'Admin identity is not authorized',
        statusCode: 403,
      ),
    );
    expect(f.kind, SupportFailureKind.adminIdentity);
    expect(f.requiresCustomerLogin, isTrue);
    expect(f.message, contains('no permissions'));
  });
  test('ownership denial never becomes customer identity authorization', () {
    final f = SupportFailure.from(
      const SupportApiException('private-ticket', statusCode: 403),
    );
    expect(f.kind, SupportFailureKind.authorization);
    expect(f.requiresCustomerLogin, isFalse);
    expect(f.message, isNot(contains('private-ticket')));
  });
  test(
    'session, connectivity, provider and unknown errors remain distinct and sanitized',
    () {
      expect(
        SupportFailure.from(
          const SupportApiException('expired', statusCode: 401),
        ).kind,
        SupportFailureKind.authentication,
      );
      expect(
        SupportFailure.from(TimeoutException('secret')).kind,
        SupportFailureKind.network,
      );
      expect(
        SupportFailure.from(
          const SupportApiException('secret', statusCode: 503),
        ).kind,
        SupportFailureKind.unavailable,
      );
      expect(
        SupportFailure.from(StateError('postgresql://secret')).message,
        isNot(contains('secret')),
      );
    },
  );
  testWidgets('render, opening guidance and cancel never log out', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CustomerSupportRecoveryButton(
            signOut: () async {
              calls++;
            },
          ),
        ),
      ),
    );
    expect(calls, 0);
    await tester.tap(find.text('Use a customer account'));
    await tester.tap(find.text('Use a customer account'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(calls, 0);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(calls, 0);
  });
  testWidgets('confirmed recovery reuses logout once before navigating', (
    tester,
  ) async {
    var calls = 0, navigations = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CustomerSupportRecoveryButton(
            signOut: () async {
              calls++;
            },
            onSignedOut: () {
              navigations++;
            },
          ),
        ),
      ),
    );
    await tester.tap(find.text('Use a customer account'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out and continue'));
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(navigations, 1);
  });
  testWidgets('failed logout does not navigate or reveal the exception', (
    tester,
  ) async {
    var navigations = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CustomerSupportRecoveryButton(
            signOut: () async {
              throw StateError('private-token');
            },
            onSignedOut: () {
              navigations++;
            },
          ),
        ),
      ),
    );
    await tester.tap(find.text('Use a customer account'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out and continue'));
    await tester.pumpAndSettle();
    expect(navigations, 0);
    expect(find.textContaining('could not be confirmed'), findsOneWidget);
    expect(find.textContaining('private-token'), findsNothing);
  });
}
