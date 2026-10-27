import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/presentation/auth_gate.dart';

class _LoggedOutSession extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('logged-out auth gate exposes welcome and supported portals', (
    tester,
  ) async {
    // Exercise routing without invoking native push/Firebase initialization.
    await tester.pumpWidget(
      MaterialApp(home: AuthGate(sessionStore: _LoggedOutSession())),
    );

    // The welcome artwork intentionally animates continuously.
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Your stars.\nYour path.'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);

    await tester.tap(find.text('Skip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(find.text('Continue as Customer'), findsOneWidget);

    expect(find.text('Astrologer Login'), findsOneWidget);

    expect(find.text('Join as Astrologer'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
