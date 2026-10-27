import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/customer_email_address.dart';
import 'package:astro_soul_path/features/customer/presentation/screens/edit_customer_profile_screen.dart';

StoredAuthSession session({
  String? email = 'customer@example.test',
  bool verified = true,
  String? claimEmail,
}) => StoredAuthSession(
  accessToken:
      'header.${base64Url.encode(utf8.encode(jsonEncode({'email': claimEmail ?? email, 'email_verified': verified})))}.signature',
  refreshToken: '',
  role: 'CUSTOMER',
  portal: 'customer',
  nextStep: 'OPEN_CUSTOMER_HOME',
  user: {'id': 'canonical', 'email': email, 'phone': '+19999999999'},
  expiresIn: 3600,
  authProvider: 'firebase',
);

class Sessions extends AuthSessionStore {
  Sessions(this.value);
  final StoredAuthSession? value;
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async => value;
}

void main() {
  testWidgets('email display never falls back to phone or a missing session', (
    tester,
  ) async {
    for (final value in [session(), session(email: null), null]) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: CustomerEmailAddress(session: value)),
        ),
      );
      expect(find.text(CustomerEmailAddress.emailOf(value)), findsOneWidget);
      expect(find.text('+19999999999'), findsNothing);
    }
  });
  testWidgets('read-only email badge requires matching verified email proof', (
    tester,
  ) async {
    for (final value in [
      session(),
      session(verified: false),
      session(claimEmail: 'foreign@example.test'),
    ]) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerEmailAddress(session: value, asField: true),
          ),
        ),
      );
      expect(tester.widget<TextField>(find.byType(TextField)).readOnly, isTrue);
      expect(
        find.byTooltip('Verified email'),
        CustomerEmailAddress.isVerified(value) ? findsOneWidget : findsNothing,
      );
    }
  });
  testWidgets(
    'default edit profile displays canonical email and hides phone controls',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: EditCustomerProfileScreen(
            profile: null,
            sessionStore: Sessions(session()),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Email Address'), findsOneWidget);
      expect(find.text('customer@example.test'), findsOneWidget);
      expect(find.text('Mobile Number'), findsNothing);
      expect(find.text('Verified mobile number'), findsNothing);
      expect(find.text('Verify'), findsNothing);
      expect(find.text('+19999999999'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'missing canonical email remains neutral despite verified claim',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: EditCustomerProfileScreen(
            profile: null,
            sessionStore: Sessions(
              session(email: null, claimEmail: 'foreign@example.test'),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Email unavailable'), findsOneWidget);
      expect(find.text('foreign@example.test'), findsNothing);
      expect(find.byTooltip('Verified email'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
